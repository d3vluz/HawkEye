// Critérios de inspeção (linha única no banco) e a regra que decide se uma captura é aprovada.

import { BadRequestException, Injectable } from '@nestjs/common';
import { InspectionSettings } from '@prisma/client';
import { BancoService } from '../banco/banco.service';
import { NovosCriterios } from './dto';

const ID_DOS_CRITERIOS = 1;

export interface DefeitosDaCaptura {
  linhasDaGrade?: number;
  colunasDaGrade?: number;
  compartimentos: number;
  pinoFaltando: boolean;
  pinoAMais: boolean;
  pinoDanificado: boolean;
  corErrada: boolean;
  hasteComDefeito: boolean;
  estruturaCorrigida?: boolean;
}

@Injectable()
export class CriteriosService {
  constructor(private banco: BancoService) {}

  ler() {
    return this.banco.inspectionSettings.upsert({ where: { id: ID_DOS_CRITERIOS }, create: { id: ID_DOS_CRITERIOS }, update: {} });
  }

  salvar(dados: NovosCriterios, matriculaDeQuemSalvou: string | null) {
    if ((dados.expectedRows === null) !== (dados.expectedCols === null)) {
      throw new BadRequestException('Informe linhas e colunas juntas, ou deixe as duas em branco');
    }
    const registro = { ...dados, updatedByMatricula: matriculaDeQuemSalvou };
    return this.banco.inspectionSettings.upsert({
      where: { id: ID_DOS_CRITERIOS },
      create: { id: ID_DOS_CRITERIOS, ...registro },
      update: registro,
    });
  }

  veredito(criterios: InspectionSettings, defeitos: DefeitosDaCaptura) {
    const danoEstrutural = defeitos.estruturaCorrigida ?? this.temDanoEstrutural(criterios, defeitos);
    const reprovada =
      (criterios.rejectMissingPins && defeitos.pinoFaltando) ||
      (criterios.rejectExtraPins && defeitos.pinoAMais) ||
      (criterios.rejectDamagedPins && defeitos.pinoDanificado) ||
      (criterios.rejectWrongColorPins && defeitos.corErrada) ||
      (criterios.rejectShaftDefects && defeitos.hasteComDefeito) ||
      (criterios.rejectStructureDamage && danoEstrutural);
    return { aprovada: !reprovada, danoEstrutural };
  }

  private temDanoEstrutural(criterios: InspectionSettings, defeitos: DefeitosDaCaptura) {
    const { expectedRows, expectedCols } = criterios;
    const { linhasDaGrade, colunasDaGrade, compartimentos } = defeitos;
    const temGradeEsperada = expectedRows !== null && expectedCols !== null;
    if (linhasDaGrade === undefined || colunasDaGrade === undefined) {
      return temGradeEsperada && compartimentos !== expectedRows! * expectedCols!;
    }
    const compartimentosUnidos = compartimentos < linhasDaGrade * colunasDaGrade;
    const gradeDiferente = temGradeEsperada && (linhasDaGrade !== expectedRows || colunasDaGrade !== expectedCols);
    return compartimentosUnidos || gradeDiferente;
  }
}
