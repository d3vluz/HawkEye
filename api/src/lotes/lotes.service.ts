// Registro, consulta e exclusão de lotes; ao registrar, as imagens passam do bucket de revisão para o permanente.

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DefectType, Prisma } from '@prisma/client';
import { ArmazenamentoService } from '../armazenamento/armazenamento.service';
import { MembroDaSessao } from '../autenticacao/decoradores';
import { BancoService } from '../banco/banco.service';
import { LOTE_COMPLETO, loteResumido, resultadoDaCaptura, TIPO_DO_DEFEITO } from '../comum/lotes';
import { CriteriosService } from '../configuracoes/criterios.service';
import { CapturaRevisada, NovoLote } from './dto';

// Nomes fixos dos arquivos de cada captura dentro de {pasta do lote}/{sha256}/.
const ARQUIVOS_DA_CAPTURA = {
  original_uri: (nome: string) => `original_${nome}`,
  processed_areas_uri: () => 'processed_areas.png',
  processed_pins_uri: () => 'processed_pins.png',
  processed_uri: () => 'processed_boxes.png',
  processed_shaft_uri: () => 'processed_shafts.png',
} as const;

type CampoDeImagem = keyof typeof ARQUIVOS_DA_CAPTURA;
const CAMPOS_DE_IMAGEM = Object.keys(ARQUIVOS_DA_CAPTURA) as CampoDeImagem[];

@Injectable()
export class LotesService {
  constructor(
    private banco: BancoService,
    private armazenamento: ArmazenamentoService,
    private criterios: CriteriosService,
  ) {}

  async registrar(dados: NovoLote, autorDoLote: MembroDaSessao) {
    await this.exigirAcessoALinha(autorDoLote.id, dados.unit_id);
    if (await this.banco.batch.count({ where: { storageFolder: dados.batch_timestamp } })) {
      throw new ConflictException('Este lote já foi registrado');
    }
    const criterios = await this.criterios.vigentes();

    const capturas = dados.captures.map((captura) => ({
      filename: captura.filename,
      sha256: captura.sha256,
      defects: { create: this.defeitosDaCaptura(captura, this.criterios.danoEstrutural(criterios, {
        linhas: captura.grid_rows,
        colunas: captura.grid_cols,
        compartimentos: captura.areas_detected,
      })) },
    }));

    for (const captura of dados.captures) await this.moverImagens(dados.batch_timestamp, captura);

    const lote = await this.banco.batch.create({
      data: {
        name: dados.name,
        description: dados.description,
        storageFolder: dados.batch_timestamp,
        authorId: autorDoLote.id,
        unitId: dados.unit_id,
        criteriaId: criterios.id,
        captures: { create: capturas },
      },
      include: LOTE_COMPLETO,
    });

    const resumo = loteResumido(lote);
    return {
      success: true,
      message: `Lote '${dados.name}' criado com sucesso`,
      batch_id: lote.id,
      total_captures: resumo.total_captures,
      valid_captures: resumo.valid_captures,
      invalid_captures: resumo.invalid_captures,
    };
  }

  async descartar(timestamp: string) {
    await this.armazenamento.apagarPasta(timestamp, this.armazenamento.revisao);
    return { success: true, message: `Lote ${timestamp} rejeitado`, timestamp };
  }

  listarTodos(linhaId?: string) {
    return this.listar({ unitId: linhaId });
  }

  listarDoAutor(autorId: string) {
    return this.listar({ authorId: autorId });
  }

  detalhar(id: string) {
    return this.buscarDetalhe({ id });
  }

  detalharDoAutor(id: string, autorId: string) {
    return this.buscarDetalhe({ id, authorId: autorId });
  }

  async remover(id: string) {
    const lote = await this.banco.batch.findUnique({ where: { id }, select: { storageFolder: true } });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    await this.armazenamento.apagarPasta(lote.storageFolder, this.armazenamento.permanente);
    await this.banco.batch.delete({ where: { id } });
    return { success: true };
  }

  // Só entram os defeitos que o sistema apontou ou que o operador marcou; o resto fica implícito como ausente.
  private defeitosDaCaptura(captura: CapturaRevisada, estruturaDetectada: boolean) {
    const contagens = captura.detected_counts;
    const linhas: Array<{ type: DefectType; detectedCount: number; present: boolean }> = [
      { type: TIPO_DO_DEFEITO.missing, detectedCount: contagens.missing, present: captura.has_missing_pins },
      { type: TIPO_DO_DEFEITO.extra, detectedCount: contagens.extra, present: captura.has_extra_pins },
      { type: TIPO_DO_DEFEITO.wrongColor, detectedCount: contagens.wrongColor, present: captura.has_wrong_color_pins },
      { type: TIPO_DO_DEFEITO.damaged, detectedCount: contagens.damaged, present: captura.has_damaged_pins },
      { type: TIPO_DO_DEFEITO.shaft, detectedCount: contagens.shaft, present: captura.has_shaft_defects },
      {
        type: TIPO_DO_DEFEITO.structure,
        detectedCount: estruturaDetectada ? 1 : 0,
        present: captura.structure_override ?? estruturaDetectada,
      },
    ];
    return linhas.filter((d) => d.detectedCount > 0 || d.present);
  }

  private async moverImagens(pasta: string, captura: CapturaRevisada) {
    for (const campo of CAMPOS_DE_IMAGEM) {
      await this.armazenamento.moverParaPermanente(`${pasta}/${captura.sha256}/${ARQUIVOS_DA_CAPTURA[campo](captura.filename)}`);
    }
  }

  private urlsDaCaptura(pasta: string, captura: { sha256: string; filename: string }) {
    return Object.fromEntries(
      CAMPOS_DE_IMAGEM.map((campo) => [
        campo,
        this.armazenamento.urlPublica(`${pasta}/${captura.sha256}/${ARQUIVOS_DA_CAPTURA[campo](captura.filename)}`, this.armazenamento.permanente),
      ]),
    ) as Record<CampoDeImagem, string>;
  }

  private async exigirAcessoALinha(membroId: string, linhaId: string) {
    const [membro, linhaExiste] = await Promise.all([
      this.banco.member.findUnique({
        where: { id: membroId },
        select: { allUnits: true, units: { where: { unitId: linhaId }, select: { unitId: true } } },
      }),
      this.banco.unit.count({ where: { id: linhaId } }),
    ]);
    if (!linhaExiste) throw new BadRequestException('Linha não encontrada');
    if (!membro?.allUnits && !membro?.units.length) throw new ForbiddenException('Você não tem acesso a esta linha');
  }

  private async listar(filtro: Prisma.BatchWhereInput) {
    const lotes = await this.banco.batch.findMany({ where: filtro, orderBy: { createdAt: 'desc' }, include: LOTE_COMPLETO });
    return { batches: lotes.map(loteResumido) };
  }

  private async buscarDetalhe(filtro: { id: string; authorId?: string }) {
    const lote = await this.banco.batch.findFirst({
      where: filtro,
      include: {
        ...LOTE_COMPLETO,
        captures: { orderBy: { filename: 'asc' }, select: { id: true, filename: true, sha256: true, defects: true } },
      },
    });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    return {
      batch: loteResumido(lote),
      captures: lote.captures.map((c) => {
        const resultado = resultadoDaCaptura(c.defects, lote.criteria);
        return {
          id: c.id,
          filename: c.filename,
          is_valid: resultado.aprovada,
          ...this.urlsDaCaptura(lote.storageFolder, c),
          defects_count: resultado.quantidade,
          defects: resultado.defeitos,
          corrections: resultado.correcoes.length ? resultado.correcoes : null,
        };
      }),
    };
  }
}
