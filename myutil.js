var http = require('http')
  , zlib = require('zlib')
  , url = require('url')
  , fs = require('fs');


exports.http_get = function(target_url, callback) {
/*
  var cached = 'data/'+target_url;
  if (fs.exists(cached)) {
    var rs = fs.createReadStream(cached);
    rs.headers = {};
    rs.headers['content-encoding'] = 'gzip';
    callback(rs);
    return;
  }
*/
  var headers = {
    "accept-charset" : "ISO-8859-1,utf-8;q=0.7,*;q=0.3",
    "accept-language" : "en-US,en;q=0.8",
    "accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "user-agent" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2",
    "accept-encoding" : "gzip,deflate",
  };

  var parsed = url.parse(target_url);
  var options = {
    hostname: parsed.hostname,
    path: parsed.path,
    headers: headers
  };
 
  http.get(options, callback);
};
