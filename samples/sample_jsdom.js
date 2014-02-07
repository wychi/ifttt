var jsdom = require('jsdom').jsdom;

var update = function(bookId) {
  var url = 'http://ck101.com/thread-' + bookId + '-999-1.html';

  jsdom.env(
    url,
    ["http://code.jquery.com/jquery.js"],
    function (errors, window) {
      console.log("there have been", window.$("a").length, "nodejs releases!");
    }
  );
};


update('2739729');

