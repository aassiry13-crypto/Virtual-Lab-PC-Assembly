// Package the existing application as one downloadable HTML file for offline guest use.
// Run npm run build first so the current Tailwind stylesheet is available.
import { build } from 'esbuild';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const images={};
for(const file of await readdir(path.join(root,'public/images'))){
 if(!/\.(svg|png|jpg|webp)$/.test(file))continue;
 const type=file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/jpeg';
 images[file]=`data:${type};base64,${(await readFile(path.join(root,'public/images',file))).toString('base64')}`;
}
const result=await build({
 absWorkingDir:root,entryPoints:['src/main.tsx'],bundle:true,write:false,outfile:'work/offline-bundle.js',format:'iife',minify:true,target:'es2022',jsx:'automatic',
 define:{'process.env.NODE_ENV':'"production"','import.meta.env.BASE_URL':'"./"','import.meta.env.DEV':'false','import.meta.env.PROD':'true','import.meta.env.VITE_API_URL':'""'},
 plugins:[{name:'embed-offline-assets',setup(b){
  b.onLoad({filter:/src\/App\.tsx$/},async args=>{
   let source=await readFile(args.path,'utf8');
   const pattern=/const image = \(name: string\) =>\s*`\$\{import\.meta\.env\.BASE_URL\}images\/\$\{name\}`;/;
   if(!pattern.test(source))throw new Error('Image helper changed; update standalone packaging.');
   source=source.replace(pattern,`const offlineImages:Record<string,string>=${JSON.stringify(images)}; const image=(name:string)=>offlineImages[name]||'';`);
   return {contents:source,loader:'tsx'};
  });
  b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'css'}));
 }}]
});
const js=result.outputFiles.find(f=>f.path.endsWith('.js'))?.text||result.outputFiles[0].text;
const assets=await readdir(path.join(root,'dist/assets'));
const css=await readFile(path.join(root,'dist/assets',assets.find(f=>f.endsWith('.css'))),'utf8');
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0c1524"><title>إتقان | تجربة صيانة الحاسب</title><style>${css.replace(/<\/style/gi,'<\\/style')}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
await mkdir(path.join(root,'standalone'),{recursive:true});
await writeFile(path.join(root,'standalone/index.html'),html);
console.log(`standalone/index.html: ${Buffer.byteLength(html)} bytes; all application code and images embedded; guest-only storage.`);
