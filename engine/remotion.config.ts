/**
 * Configuracao do Remotion Studio e do CLI.
 *
 * O render de producao NAO passa por aqui: ele roda por `scripts/render.mjs`,
 * que decide concorrencia e renderizador por projeto. Este arquivo serve ao
 * Studio e a chamadas manuais do CLI.
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);

/**
 * WebGL via ANGLE (D3D11 no Windows). Sem isto o Chromium headless cai em
 * SwiftShader, que renderiza 3D por software — ordens de grandeza mais lento.
 *
 * O preco: a documentacao do Remotion registra vazamento de memoria do Chrome
 * com `angle` em renders longos, e por isso recomenda render em partes. E a
 * razao de `scripts/render.mjs` existir e de o render por cena ser o padrao
 * quando ha cena 3D.
 */
Config.setChromiumOpenGlRenderer("angle");

export {};
