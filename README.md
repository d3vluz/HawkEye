<div align="center">

  <img src="assets/logo_project.png" alt="HawkEye" width="140">

  <h3>HawkEye</h3>
  <p><strong>Inspeção de qualidade por visão computacional</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js">
    <img src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS">
    <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
    <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white" alt="OpenCV">
    <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
    <img src="https://img.shields.io/badge/licença-MIT-blue?style=flat-square" alt="Licença MIT">
  </p>

</div>

---

Numa linha de produção, alguém precisa olhar cada caixa de componentes e conferir se está tudo certo: se nenhum pino falta, se nenhum está torto, quebrado ou com a cor errada, se a própria caixa não está danificada. É um trabalho repetitivo, cansativo e fácil de errar.

O **HawkEye** faz essa conferência a partir de uma foto. O operador envia as imagens do lote, o sistema aponta o que encontrou em cada compartimento e a pessoa só confirma (ou corrige) antes de registrar. Tudo fica guardado, e a gestão acompanha a qualidade de cada linha num painel.

## Como funciona

### 1. O operador envia as fotos do lote

Na tela de inspeção, o operador arrasta as capturas da caixa (até 10 por vez) e pede a análise.

![Envio das imagens para inspeção](docs/imagens/inspecao.jpg)

### 2. O sistema analisa cada imagem

Cada foto passa por quatro verificações: a grade da caixa, os pinos, o conteúdo de cada compartimento e as hastes (as agulhas). Cada etapa gera uma imagem marcada mostrando o que foi visto.

![Etapas da análise: grade, pinos, compartimentos e hastes](docs/imagens/pipeline.jpg)

Quando algo está errado, a marcação aparece em vermelho:

![Exemplos de defeitos detectados](docs/imagens/defeitos.jpg)

### 3. Uma pessoa revisa antes de registrar

Nada é salvo automaticamente. O operador vê o resultado de cada captura, pode corrigir o que o sistema errou e então registra o lote ou o descarta.

![Revisão do lote antes do registro](docs/imagens/revisao.jpg)

### 4. A gestão acompanha a qualidade

O administrador vê a taxa de aprovação, os defeitos mais comuns, o desempenho de cada linha de produção e quem mais inspecionou.

![Dashboard de qualidade](docs/imagens/dashboard.jpg)

Cada lote pode ser aberto para ver captura por captura, com todas as camadas da análise:

![Detalhe de um lote registrado](docs/imagens/detalhe-do-lote.jpg)

## O que o sistema detecta

| Defeito | O que significa |
|---------|-----------------|
| Pino faltando | Um compartimento está vazio |
| Pino a mais | Mais de um pino no mesmo compartimento |
| Cor errada | Pino fora da cor padrão |
| Pino danificado | Corpo do pino deformado ou lascado |
| Haste com defeito | Agulha quebrada, curta ou torta |
| Dano estrutural | Divisória ausente ou grade diferente da esperada |

> **Os critérios são configuráveis: o administrador escolhe quais defeitos reprovam uma captura e qual a meta de qualidade dos lotes.**

## Resultados

Medido em um conjunto de **668 imagens reais rotuladas**, o sistema dá o veredito certo (aprovar ou reprovar) em **93,4%** dos casos. Pinos ausentes, pinos a mais, cor errada e dano estrutural são acertados em 100% das imagens desses tipos. Os detalhes estão em [Visão computacional](docs/visao-computacional.md#resultados).

As imagens usadas nos testes e nos prints vêm da categoria *pushpins* do [MVTec LOCO AD](https://www.mvtec.com/company/research/datasets/mvtec-loco), reorganizadas em 8 classes de defeito. A versão reorganizada está em [dataset.zip](https://github.com/d3vluz/HawkEye/releases) e segue a licença original do dataset (CC BY-NC-SA 4.0), não a licença MIT do código.

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [Arquitetura](docs/arquitetura.md) | Serviços, fluxo de uma inspeção, autenticação e decisões |
| [Banco de dados](docs/banco-de-dados.md) | Tabelas, relações e regras de integridade |
| [API](docs/api.md) | Rotas, perfis de acesso e formato das requisições |
| [Visão computacional](docs/visao-computacional.md) | Como cada etapa da análise decide e como medir a acurácia |
| [Frontend](docs/frontend.md) | Telas, organização do código e convenções |
| [Desenvolvimento](docs/desenvolvimento.md) | Como rodar, variáveis de ambiente e problemas comuns |

## Licença

Projeto desenvolvido para fins de estudo. Licenciado sob a [MIT License](LICENSE).
