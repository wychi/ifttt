var myutil = require('../myutil.js')
var http = require('http')
  , zlib = require('zlib');
var Q = require('q');
var fs = require('fs');

var getDB = function(bookId) {
  console.log('getDB ', bookId);
  var defer = Q.defer();

  var db = {};
  var DB_PATH = ''+bookId+'.json';
  if(fs.existsSync(DB_PATH)) {
    fs.readFile(DB_PATH, function(err, data) {
      if (err) throw err;
      db = JSON.parse(data);
      defer.resolve(db);
    })
  } else {
    console.log('first');
    db.bookId = bookId;
    db.pageNum = 82;
    db.filepath = DB_PATH;

    defer.resolve(db);
  }

  return defer.promise;
};

var saveDB = function(db) {
  console.log('saveDB', db);

  var defer = Q.defer();
  fs.writeFile(db.filepath, JSON.stringify(db), function(err) {
    if (err) throw err;

    console.log('saved');
    defer.resolve(db);
  });

  return defer.promise;
}

var fetch = function(bookId, pageNum) {
  var defer = Q.defer();
  var url = 'http://ck101.com/thread-' + bookId + '-' + pageNum + '-1.html';
  console.log(url);
  var options = myutil.build_http_options(url);
  http.get(options, function(res) {
    var stream;
    var encoding = res.headers['content-encoding']
    if (encoding == 'gzip') {
      stream = res.pipe(zlib.createGunzip());
    } else if (encoding == 'deflate') {
      stream = res.pipe(zlib.createInflate());
    }
    var html = '';
    stream.on('data', function(chunk) {
      html += chunk;
    });
    stream.on('end', function() {
      defer.resolve(html);
    });
  });

  return defer.promise;
};

var doParse = function(html) {
  var cheerio = require('cheerio'),
      $ = cheerio.load(html);
  var bookTitle = $('h1.viewTitle').text();
  var pageNum = $('#postlist .pg:last-child strong').text();
  var hasNewPage = $('#postlist .pg:last-child :last-child').is('a');

  var items = $('.postList').map(function(i, elem) {
    var $this = $(this);
    var pid = $this.attr('id');
    var pubDate = $this.find('.userInfo em').text();
    var $body = $this.find('.postmessage');
    var firstLine = $( $body.children()[0] );

    var obj = {};
    obj.id = pid;
    obj.pubDate = pubDate;
    obj.title = firstLine.text();
    obj.content = $body.text();
    obj.pageNum = pageNum;

    return obj;
  });

  var meta = {};
  meta.bookTitle = bookTitle;
  meta.pageNum = pageNum;
  meta.hasNewPage = hasNewPage;
  meta.items = items;

  return meta;
};

//fetch('2739729');
//fetch('2843815');
var update = function(bookId) {
  getDB(bookId)
  .then(function(db) {
    var bookId = db.bookId;
    var pageNum = db.pageNum;
    if(db.hasNewPage) {
      pageNum += 1;
      delete db.hasNewPage;
    }
    var html = fetch(bookId, pageNum);

    return Q.all([db, html]);
  })
  .then(function(data) {
    var db = data[0];
    var html = data[1];

    var meta = doParse(html);

    var items = meta.items;
    // for(var i=0;i<items.length;i++) {
    //   var item = items[i];
    //   console.log(item.id);
    // }

    db.hasNewPage = meta.hasNewPage;
    db.pageNum = meta.pageNum;
    db.lastPost = items[items.length-1].id;

    return saveDB(db);
  })
  .then(function(db) {
    if(db.hasNewPage) {
      update(db.bookId);
    }
  })
  .fail(function(err) {
    console.log(err);
  });
}

update('2594030');