var myUtil = require('./myutil.js');
var RSS = require('rss');

var http = require('http')
  , zlib = require('zlib')
  , assert = require('assert');

function Iterator(ctx) {
  var PATTERN_BEGIN = '<td class="t_f"';
  var PATTERN_END = '</td>';
  this.ctx = ctx;
  this.pos = 0;
  this.nbegin = -1;
  this.nend = -1;

  this.hasNext = function() {
    if( this.pos == -1)
      return false;

    this.nbegin = this.ctx.indexOf(PATTERN_BEGIN, this.pos);
    if (this.nbegin != -1) {
      this.nend = this.ctx.indexOf(PATTERN_END, PATTERN_BEGIN.length + this.nbegin);
    }

    return (this.nbegin != -1) && (this.nend != -1);
  };

  this.next = function() {
    if (this.nbegin == -1 || this.nend == -1)
      throw "no next";

    var begin = this.nbegin;
    var end = this.nend;

    //console.log(this.pos, this.nbegin, this.nend);
    this.pos = end + PATTERN_END.length;
    this.nbegin = -1;
    this.nend = -1;

    return this.ctx.substring(begin, end);
  }

  this.getRemains = function() {
    if( this.nbegin != -1 && this.nend == -1)
      return this.ctx.substr(this.pos);
    return null;
  };
}

var util = require('util');
var Transform = require('stream').Transform;
util.inherits(CK101Protocol, Transform);

function CK101Protocol(options) {
  if (!(this instanceof CK101Protocol))
    return new CK101Protocol(options);

  Transform.call(this, options);
  this.remains_ = undefined;
  this.count = 0; // TODO: tmp solution for pubDate

  this.feed = new RSS(options);
};

CK101Protocol.prototype._transform = function(chunk, encoding, done) {
  var str = chunk.toString();
  if (this.remains_)
    str = this.remains_ + str;

  var pubDate = new Date();
  var iter = new Iterator(str);
  while (iter.hasNext()) {
    var post = iter.next();
    var id = null, title = null, body = null;

    console.log(post.substr(0,120));

    // to parse post_id
    var id_b = post.indexOf('id="');
    var id_e = post.indexOf('"', id_b+4);
    id = post.substring(id_b+4, id_e);

    // to parse title
    var contentPos = post.indexOf('>') + 1;
    var bodyPos = contentPos;

    var firstBR = post.indexOf('<br', contentPos);
    assert(firstBR != -1);
    var firstLine = post.substring(contentPos, firstBR);
    title = firstLine;
    bodyPos = firstBR + 1;

    if (!title) {
      var elements = ['font', 'strong'];
      for(var i=0; i<elements.length; i++) {
        var pattern_b = '<' + elements[i] + ' ';
        var pattern_e = '</' + elements[i] + '>';
        var titleBegin = post.indexOf(pattern_b, contentPos);
        if (titleBegin != -1) {
          titleBegin = post.indexOf('>', titleBegin) + 1;
          var titleEnd = post.indexOf(pattern_e, titleBegin);
          title = post.substring(titleBegin, titleEnd);
          bodyPos = titleEnd + pattern_e.length;
          break;
        }
      }
    }

    if (!title) {
      // wild guess
      var pos = contentPos + 10;
      if (pos!= -1) {
        title = post.substring(contentPos, pos);
        bodyPos = contentPos;
      }
    }

    body = post.substring(bodyPos);

    // transform to RSS
    var item = {};
    item.title = title;
    item.description = body;
    item.date = new Date(pubDate.getTime() + this.count * 1000) ;
    item.guid = id;
    item.url = 'http://ck101.com/thread-2739729-999-1.html/?id='+id;
    this.feed.item(item);

    this.count++;

  }
  this.remains_ = iter.getRemains();

  done();
};

CK101Protocol.prototype._flush = function(done) {
  console.log('_flush');
  this.push(this.feed.xml());

  done();
};

exports.update = function(bookId, outStream) {
  var url = 'http://ck101.com/thread-' + bookId + '-999-1.html';
  var feed_options = {
    title: bookId,
    author: 'unknown',
  };

  myUtil.http_get(url, function(res) {
    var parser = new CK101Protocol(feed_options);
    var zs;
    var encoding = res.headers['content-encoding']
    if (encoding == 'gzip') {
      zs = zlib.createGunzip();
    } else if (encoding == 'deflate') {
      zs = zlib.createInflate();
    }

    if(zs)
      res.pipe(zs).pipe(parser).pipe(outStream);
    else
      res.pipe(parser).pipe(outStream);
  });
};


