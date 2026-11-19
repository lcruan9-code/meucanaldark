# Pipeline e Arquitetura do Motor Gerador de Documentários
**Projeto:** The Invisible Systems — Automação de Produção Documental

---

## 1. Visão Geral
Um roteiro profissional para um motor gerador de documentários não contém apenas texto corrido para narração; ele funciona como uma **especificação estruturada** que guia pesquisa, geração visual, continuidade espacial e montagem final.

---

## 2. As 8 Etapas do Pipeline Ideal

1. **Roteiro (Narrative Engine)**  
   Recebe o tema central, estrutura o arco dramático (Hook -> Contexto -> Mecanismo -> Operação -> Falha -> Escala -> Futuro -> Conclusão) e redige a narração com controle de duração por minuto.
2. **Verificação Factual (Fact-Checking Layer)**  
   Confere afirmações técnicas, ordens de grandeza, terminologia de engenharia (ex.: *optical repeaters*, *seabed sediment*, *cable-laying vessel*) e cruza com fontes confiáveis antes de liberar para produção.
3. **Direção Audiovisual (Visual Director)**  
   Segmenta a narração em unidades de cena com timecodes e define **o que** o espectador precisa ver e compreender em cada frase.
4. **Produção Visual (Asset & Render Router)**  
   Decide qual técnica visual aplicar em cada plano:
   - Filmagens reais / *stock* curado (data centers, navios, paisagens costeiras);
   - Modelagem e animação 3D técnica (corte de camadas do cabo, repetidores, arado submarino, ROV);
   - Mapas animados e visualização de dados (rotas globais, batimetria, redirecionamento de tráfego).
5. **Continuidade (Continuity Manager)**  
   Garante que objetos técnicos (como o cabo submarino e seus componentes internos), paleta de cores, iluminação subaquática e movimentos de câmera permaneçam consistentes entre cenas diferentes.
6. **Áudio e Edição (Audio & Timeline Assembler)**  
   Sincroniza a locução (TTS neural de alta fidelidade ou gravação humana), trilha sonora adaptativa (*ducking* automático sob a voz), efeitos sonoros (*SFX* subaquáticos, pulsos ópticos, ambiente industrial) e legendas estilizadas.
7. **Controle de Qualidade (Pedagogical & Visual QA)**  
   Audita o corte montado para verificar se o vídeo **realmente explica** o funcionamento técnico com clareza — e não apenas exibe imagens bonitas desconexas da narração.
8. **Renderização Final (Master Delivery)**  
   Exporta o documentário finalizado em 4K/1080p (16:9), juntamente com metadados, capítulos do YouTube e arquivo de legendas `.srt`.
