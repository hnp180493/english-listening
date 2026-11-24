// Written by scripts/portraits.mjs (npm run portraits): the residents' drawn portraits in public/portraits
// (docs/portrait-prompts.md), by place id, each with a hash of its file (a new picture is fetched again).
// Not edited by hand.

export const PORTRAIT_FILES: Readonly<Record<string, Partial<Record<string, string>>>> = {
  board: { happy: '371b2cd1e2', sad: '6685f4c02e', neutral: '627712ef1b' },
  cafe: { happy: '802c896f59', love: '6df17103d5', moved: 'a74ed237f1', pout: '25d34bdfc4', sad: '22730c625e', surprised: '7ee7b4cbcf', neutral: '20c0bcfcdb' },
  cinema: { happy: 'a3b2f5bd6a', sad: '30f7f8bfe4', neutral: 'b212f1713d' },
  clinic: { happy: '0a8c9ac73f', sad: '4a51e3961a', neutral: '0302f289f3' },
  home: { happy: 'c42569a652', sad: '095272e588', neutral: '7976b639ae' },
  park: { happy: '69cce4ebbd', sad: '48633688ec', neutral: 'a5ca24ffac' },
  phone: { happy: '3baca5b70f', sad: '8d3f16c502', neutral: 'f99ca806de' },
  school: { happy: '99a66ee1ed', sad: 'b4ef479359', neutral: '3edfe03aa0' },
  shop: { happy: '55ed67a747', sad: 'dae0afc53d', neutral: '8070913bea' },
  square: { happy: '6ba2f76204', sad: '30e444fe79', neutral: '6e18ffe939' },
  station: { happy: 'd004617ca2', sad: 'e85c92477f', neutral: 'cb04b7884d' },
};
