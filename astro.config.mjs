// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages 무료 주소(username.github.io)에 루트로 배포하려면
// 리포지토리 이름을 정확히 "stlahxm.github.io"로 만들어야 함.
// https://astro.build/config
export default defineConfig({
  site: 'https://stlahxm.github.io',
});
