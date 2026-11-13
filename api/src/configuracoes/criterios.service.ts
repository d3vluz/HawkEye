// Critérios de inspeção em versões imutáveis: salvar cria uma versão nova, e cada lote guarda a versão com que foi julgado.

import { BadRequestException, Injectable } from '@nestjs/common';
import { InspectionCriteria } from '@prisma/client';
import { BancoService } from '../banco/banco.service';
import { NovosCriterios } from './dto';

export interface GradeObservada {
  linhas?: number;
  colunas?: number;
  compartimentos: number;
}

const COM_AUTOR = { createdBy: { select: { matricula: true } } } as const;

@Injectable()
export class CriteriosService {
  constructor(private banco: BancoService) {}

  async vigentes() {
    const ultima = await this.banco.inspectionCriteria.findFirst({ orderBy: { id: 'desc' }, include: COM_AUTOR });
    return ultima ?? this.banco.inspectionCriteria.create({ data: {}, include: COM_AUTOR });
  }

  async ler() {
    return this.paraResposta(await this.vigentes());
  }

  async salvar(dados: NovosCriterios, quemSalvouId: string) {
    if ((dados.expectedRows === null) !== (dados.expectedCols === null)) {
      throw new BadRequestException('Informe linhas e colunas juntas, ou deixe as duas em branco');
    }
    const versao = await this.banco.inspectionCriteria.create({ data: { ...dados, createdById: quemSalvouId }, include: COM_AUTOR });
    return this.paraResposta(versao);
  }

  // Compartimentos unidos (divisória ausente) ou grade diferente da esperada contam como dano estrutural.
  danoEstrutural(criterios: InspectionCriteria, grade: GradeObservada) {
    const { expectedRows, expectedCols } = criterios;
    const temGradeEsperada = expectedRows !== null && expectedCols !== null;
    if (grade.linhas === undefined || grade.colunas === undefined) {
      return temGradeEsperada && grade.compartimentos !== expectedRows * expectedCols;
    }
    const compartimentosUnidos = grade.compartimentos < grade.linhas * grade.colunas;
    const gradeDiferente = temGradeEsperada && (grade.linhas !== expectedRows || grade.colunas !== expectedCols);
    return compartimentosUnidos || gradeDiferente;
  }

  // Mantém as chaves que o frontend já usa: a data e o autor da versão aparecem como "última alteração".
  private paraResposta({ createdAt, createdBy, createdById: _autor, ...criterios }: InspectionCriteria & { createdBy: { matricula: string } | null }) {
    return { ...criterios, updatedAt: createdAt, updatedByMatricula: createdBy?.matricula ?? null };
  }
}
