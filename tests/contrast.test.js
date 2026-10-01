import test from 'node:test';
import assert from 'node:assert/strict';
function luminance(hex){const c=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const textPairs=[['192f49','ffffff'],['53667e','ffffff'],['53667e','f3f5f9'],['ffffff','194dc7'],['ffffff','122d4b'],['cddbea','122d4b'],['bbcbde','122d4b'],['d7e3f0','122d4b'],['264d9c','eaf0ff'],['4a5d75','f0f3f7'],['225d4d','e9f4ef'],['536080','edf0fb'],['785945','f8eee5'],['3c6660','e5f0ed'],['86591c','ffffff'],['315b4e','f3f5f9'],['634a1d','fff7e7'],['4a6078','f4f6fa'],['122d4b','e7edf6'],['5b7090','f8faff'],['60718a','ffffff']];
test('configured text palette exceeds WCAG AA 4.5:1',()=>{for(const [fg,bg] of textPairs)assert.ok(ratio(fg,bg)>=4.5,`#${fg} on #${bg}: ${ratio(fg,bg).toFixed(2)}`);});
test('input borders and focus rings exceed 3:1 against white',()=>{for(const fg of ['8593a5','215ce3'])assert.ok(ratio(fg,'ffffff')>=3,`#${fg}: ${ratio(fg,'ffffff')}`);});
