const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const file=path.join(__dirname,'../bible-search/dist/index.html');
http.createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}).listen(8796,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8796'));
