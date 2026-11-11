// Registro, consulta e exclusão de lotes; ao registrar, as imagens passam do bucket de revisão para o permanente.

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ArmazenamentoService } from '../armazenamento/armazenamento.service';
import { MembroDaSessao } from '../autenticacao/decoradores';
import { BancoService } from '../banco/banco.service';
import { loteResumido, nomesDosAutores } from '../comum/lotes';
import { CriteriosService } from '../configuracoes/criterios.service';
import { CapturaRevisada, NovoLote } from './dto';

const ARQUIVOS_DA_CAPTURA = {
  originalUri: (c: CapturaRevisada) => `original_${c.filename}`,
  processedAreasUri: () => 'processed_areas.png',
  processedPinsUri: () => 'processed_pins.png',
  processedUri: () => 'processed_boxes.png',
  processedShaftUri: () => 'processed_shafts.png',
} as const;

type CampoDeImagem = keyof typeof ARQUIVOS_DA_CAPTURA;
const LINHA = { select: { id: true, name: true } } as const;

@Injectable()
export class LotesService {
  constructor(
    private banco: BancoService,
    private armazenamento: ArmazenamentoService,
    private criterios: CriteriosService,
  ) {}

  async registrar(dados: NovoLote, autorDoLote: MembroDaSessao) {
    if (!autorDoLote.matricula) throw new BadRequestException('Conta sem matrícula não pode registrar coletas');
    await this.exigirAcessoALinha(autorDoLote.id, dados.unit_id);
    const criterios = await this.criterios.ler();

    const capturas = [];
    for (const captura of dados.captures) {
      const veredito = this.criterios.veredito(criterios, {
        linhasDaGrade: captura.grid_rows,
        colunasDaGrade: captura.grid_cols,
        compartimentos: captura.areas_detected,
        pinoFaltando: captura.has_missing_pins,
        pinoAMais: captura.has_extra_pins,
        pinoDanificado: captura.has_damaged_pins,
        corErrada: captura.has_wrong_color_pins,
        hasteComDefeito: captura.has_shaft_defects,
        estruturaCorrigida: captura.structure_override,
      });
      capturas.push({
        filename: captura.filename,
        sha256: captura.sha256,
        ...(await this.moverImagens(captura, dados.batch_timestamp)),
        isValid: veredito.aprovada,
        defectsCount: captura.defects_count + (veredito.danoEstrutural ? 1 : 0),
        hasMissingPins: captura.has_missing_pins,
        hasExtraPins: captura.has_extra_pins,
        hasDamagedPins: captura.has_damaged_pins,
        hasWrongColorPins: captura.has_wrong_color_pins,
        hasStructureDamage: veredito.danoEstrutural,
        hasShaftDefects: captura.has_shaft_defects,
        corrections: captura.corrections?.length ? (captura.corrections as unknown as Prisma.InputJsonValue) : undefined,
      });
    }

    const total = capturas.length;
    const aprovadas = capturas.filter((c) => c.isValid).length;
    const lote = await this.banco.batch.create({
      data: {
        name: dados.name,
        description: dados.description,
        totalCaptures: total,
        validCaptures: aprovadas,
        invalidCaptures: total - aprovadas,
        authorMatricula: autorDoLote.matricula,
        unitId: dados.unit_id,
        captures: { create: capturas },
      },
    });

    return {
      success: true,
      message: `Lote '${dados.name}' criado com sucesso`,
      batch_id: lote.id,
      total_captures: total,
      valid_captures: aprovadas,
      invalid_captures: total - aprovadas,
    };
  }

  async descartar(timestamp: string) {
    await this.armazenamento.apagarPasta(timestamp, this.armazenamento.revisao);
    return { success: true, message: `Lote ${timestamp} rejeitado`, timestamp };
  }

  listarTodos(linhaId?: string) {
    return this.listar({ unitId: linhaId });
  }

  listarDoAutor(matricula: string | null) {
    return matricula ? this.listar({ authorMatricula: matricula }) : { batches: [] };
  }

  detalhar(id: string) {
    return this.buscarDetalhe({ id });
  }

  detalharDoAutor(id: string, matricula: string | null) {
    if (!matricula) throw new NotFoundException('Lote não encontrado');
    return this.buscarDetalhe({ id, authorMatricula: matricula });
  }

  async remover(id: string) {
    const lote = await this.banco.batch.findUnique({ where: { id }, include: { captures: true } });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    const urls = lote.captures.flatMap((c) => (Object.keys(ARQUIVOS_DA_CAPTURA) as CampoDeImagem[]).map((campo) => c[campo]));

    await this.armazenamento.apagarPorUrl(urls, this.armazenamento.permanente);
    await this.banco.batch.delete({ where: { id } });
    return { success: true };
  }

  private async moverImagens(captura: CapturaRevisada, timestamp: string) {
    const urls = {} as Record<CampoDeImagem, string | undefined>;
    for (const [campo, nome] of Object.entries(ARQUIVOS_DA_CAPTURA) as Array<[CampoDeImagem, (c: CapturaRevisada) => string]>) {
      const chave = `${timestamp}/${captura.sha256}/${nome(captura)}`;
      const movida = await this.armazenamento.moverParaPermanente(chave);
      urls[campo] = movida ? this.armazenamento.urlPublica(chave, this.armazenamento.permanente) : undefined;
    }
    return { ...urls, originalUri: urls.originalUri ?? this.armazenamento.urlPublica('', this.armazenamento.permanente) };
  }

  private async exigirAcessoALinha(membroId: string, linhaId: string) {
    const [membro, linhaExiste] = await Promise.all([
      this.banco.member.findUnique({
        where: { id: membroId },
        select: { allUnits: true, units: { where: { id: linhaId }, select: { id: true } } },
      }),
      this.banco.unit.count({ where: { id: linhaId } }),
    ]);
    if (!linhaExiste) throw new BadRequestException('Linha não encontrada');
    if (!membro?.allUnits && !membro?.units.length) throw new ForbiddenException('Você não tem acesso a esta linha');
  }

  private async listar(filtro: { authorMatricula?: string; unitId?: string }) {
    const [lotes, defeitos] = await Promise.all([
      this.banco.batch.findMany({ where: filtro, orderBy: { createdAt: 'desc' }, include: { unit: LINHA } }),
      this.banco.capture.groupBy({ by: ['batchId'], where: { batch: filtro }, _sum: { defectsCount: true } }),
    ]);
    const nomes = await nomesDosAutores(this.banco, lotes.map((l) => l.authorMatricula));
    const defeitosPorLote = new Map(defeitos.map((d) => [d.batchId, d._sum.defectsCount ?? 0]));
    return { batches: lotes.map((l) => loteResumido(l, nomes, defeitosPorLote.get(l.id) ?? 0)) };
  }

  private async buscarDetalhe(filtro: { id: string; authorMatricula?: string }) {
    const lote = await this.banco.batch.findFirst({ where: filtro, include: { captures: true, unit: LINHA } });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    const nomes = await nomesDosAutores(this.banco, [lote.authorMatricula]);
    return {
      batch: loteResumido(lote, nomes, lote.captures.reduce((soma, c) => soma + c.defectsCount, 0)),
      captures: lote.captures.map((c) => ({
        id: c.id,
        filename: c.filename,
        is_valid: c.isValid,
        original_uri: c.originalUri,
        processed_uri: c.processedUri,
        processed_areas_uri: c.processedAreasUri,
        processed_pins_uri: c.processedPinsUri,
        processed_shaft_uri: c.processedShaftUri,
        defects_count: c.defectsCount,
        // Mesmas chaves usadas pela revisão no frontend e nas correções do operador.
        defects: {
          missing: c.hasMissingPins,
          extra: c.hasExtraPins,
          wrongColor: c.hasWrongColorPins,
          damaged: c.hasDamagedPins,
          shaft: c.hasShaftDefects,
          structure: c.hasStructureDamage,
        },
        corrections: c.corrections,
      })),
    };
  }
}
