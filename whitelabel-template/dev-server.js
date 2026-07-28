// Dev server locale — serve i file statici + proxy /api/gemini alla Netlify Function
// Uso: node dev-server.js (default porta 3000)
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');

var PORT = process.env.PORT || 3000;
var ROOT = __dirname;

var MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2'
};

var server = http.createServer(function(req, res){
  var parsed = url.parse(req.url, true);
  var pathname = decodeURIComponent(parsed.pathname);

  // Proxy /api/gemini alla Netlify Function locale
  if(pathname === '/api/gemini') {
    try {
      var fn = require('./netlify/functions/gemini');
      var chunks = [];
      req.on('data', function(c){ chunks.push(c); });
      req.on('end', function(){
        var body = Buffer.concat(chunks).toString('utf8');
        var event = { httpMethod: req.method, body: body, headers: req.headers };
        Promise.resolve(fn.handler(event)).then(function(r){
          res.writeHead(r.statusCode || 200, r.headers || { 'Content-Type':'application/json' });
          res.end(r.body || '');
        }).catch(function(err){
          res.writeHead(500); res.end('proxy err: ' + err.message);
        });
      });
    } catch(e) {
      res.writeHead(500); res.end('gemini function not available: ' + e.message);
    }
    return;
  }

  if(pathname === '/') pathname = '/index.html';
  var filePath = path.join(ROOT, pathname);
  if(filePath.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, function(err, data){
    if(err) { res.writeHead(404); return res.end('Not Found'); }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream',
                         'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, function(){
  console.log('════════════════════════════════════════');
  console.log('  WHITE LABEL — DEV SERVER');
  console.log('════════════════════════════════════════');
  console.log('  → http://localhost:' + PORT);
  console.log('  CTRL+C per fermare');
  console.log('════════════════════════════════════════');
});
