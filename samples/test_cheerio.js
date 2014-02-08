var myutil = require('../myutil.js')
var http = require('http')
  , zlib = require('zlib');
var Q = require('q');
var fs = require('fs');
var RSS = require('rss');

var getDB = function(bookId) {
  console.log('getDB ', bookId);
  var defer = Q.defer();

  var db = {};
  var DB_PATH = 'tmpdb/'+bookId+'.json';
  if(fs.existsSync(DB_PATH)) {
    fs.readFile(DB_PATH, function(err, data) {
      if (err) throw err;
      db = JSON.parse(data);
      defer.resolve(db);
    })
  } else {
    console.log('first');
    db.bookId = bookId;
    db.pageNum = 999;
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
  var pageNum = parseInt( $('#postlist .pg:last-child strong').text() );
  var hasNewPage = $('#postlist .pg:last-child :last-child').is('a');

  var items = $('.postList').map(function(i, elem) {
    var $this = $(this);
    var pid = $this.attr('id');
    var pubDate = $this.find('.userInfo em').text();
    var $body = $this.find('.postmessage');
    var firstLine = $($body.contents()[0]).text();
    //console.log(firstLine);

    var obj = {};
    obj.id = pid;
    obj.pubDate = pubDate;
    obj.title = firstLine;
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
var all_items = [];
var update = function(bookId) {
  return getDB(bookId)
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
    for(var i=0;i<items.length;i++) {
      var item = items[i];

      if(!db.lastPost || item.id > db.lastPost) {
        console.log(db.lastPost, item.id);
        all_items.push(item);
      }
    }

    db.bookTitle = meta.bookTitle.replace(/\r\n|\t| /g, '');
    db.hasNewPage = meta.hasNewPage;
    db.pageNum = meta.pageNum;
    db.lastPost = items[items.length-1].id;

    return saveDB(db);
  })
  .then(function(db) {
    if(db.hasNewPage) {
      return update(db.bookId);
    } else {
      return db;
    }
  })
  .fail(function(err) {
    console.log(err);
  });
}

var newItems = [];

exports.update = function(bookId, outStream) {
  update(bookId).then(function(db) {
    console.log('[update] #' + all_items.length);
    if( all_items.length > 0) {
      var title = db.bookTitle;
      var author = 'unknown';
      var parsed = db.bookTitle.match(/([^\]】]+)作者[：]?(\S+).{1}連載中.{1}/);
      console.log(parsed);
      if (parsed && parsed.length == 3) {
        title = parsed[1];
        author = parsed[2];
      }
      var feed_options = {
        title: title,
        author: author
      };
      var feed = new RSS(feed_options);
      // transform to RSS
      for(var i=0; i<all_items.length; i++) {
        var post = all_items[i];
        var item = {};
        item.title = post.title;
        item.description = post.content;
        item.date = post.pubDate;
        item.guid = post.id;
        item.url = 'http://ck101.com/thread-' + bookId + '-' + post.pageNum + '-1.html/?id='+post.id;
        feed.item(item);
      }

      all_items = [];
      return feed.xml();
    }
  })
  .then(function(xml) {
    var filepath = 'tmpdb/'+bookId+'.xml';
    if(xml) {
      fs.writeFileSync(filepath, xml);
    }

    if(fs.existsSync(filepath)) {
      var rs = fs.createReadStream(filepath);
      rs.pipe(outStream);
    } else {
      outStream.end();
    }
  })
  .fail(function(err) {
    console.log(err);
  });
};
