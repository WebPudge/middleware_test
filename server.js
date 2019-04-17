'use strict'
var http = require('http');
var url = require('url');

var routes = {'all':[]};
var app = {};

['get','put','delete','post'].forEach(function(method){
  routes[method] = [];
  app[method] = function(path){
    routes[method].push({
      path: pathRegexp(path),
      stack: Array.prototype.slice.call(arguments, 1)
    })
  }
})

// 路由变量匹配
var pathRegexp = function(path){
  path = path
  .concat('/?')
  .replace(/\/\(/g, '(?:/')
  .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g,function(_,slash,format,key,capture,optional,star){
    slash = slash ||  '';
    return ''
      + (optional?'': slash)
      + '(?:'
      + (optional?slash: '')
      + (format||'') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
      + (optional || '')
      + (star ? '(/*)?': '');
  })
  .replace(/([\/.])/g, '\\$1')
  .replace(/\*/g,'(.*)');
  return new RegExp('^' + path + '$')
}

// 路由匹配
var match = function(pathname, routes){
  var stacks = [];
  for(var i=0; i < routes.length; i++){
    var route = routes[i];

    var reg = route.path;
    var matched = reg.exec(pathname);
    if(matched){
      stacks = stacks.concat(route.stack);
    }
  }
  return stacks
}

var handle500 = function(err, req, res, stacks){
  stacks=stacks.filter(function(middleware){
    return middleware.length === 4;
  })
  var next = function(){
    var middleware = stacks.shift();
    if(middleware){
      middleware(err, req, res, next);
    }
  }
  next();
}

// 中间件调用
var handle = function(req,res,stacks){
  var next = function(err){
    if(err){
      return handle500(err,req,res,stacks)
    }
    var middleware = stacks.shift();
    try {
      if(middleware){
        middleware(req,res,next);
      }
    } catch (e) {
      next(e);
    }
  }
  next();
}

app.use = function(path){
  var handle;
  if( typeof path == 'string'){
    handle = {
      path: pathRegexp(path),
      stack: Array.prototype.slice.call(arguments, 1)
    }
  } else {
    handle = {
      path: pathRegexp('/'),
      stack: Array.prototype.slice.call(arguments, 0)
    }
  }
  routes.all.push(handle)
}

// 路由
app.get('/',function(req,res){
  res.writeHead(200);
  res.end('hello middleware');
})


http.createServer(function(req, res){
  var pathname = url.parse(req.url).pathname;
  
  var method = req.method.toLowerCase();
  
  var stacks = match(pathname,routes.all);
  if(routes.hasOwnProperty(method)){
    match(pathname, routes[method])
    stacks = stacks.concat(match(pathname, routes[method]))
  }
  if(stacks.length){
    handle(req,res,stacks)
  }
}).listen(4000);
console.log('http://localhost:4000')