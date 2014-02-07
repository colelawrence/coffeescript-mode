(function() {
  CodeMirror.defineMode("coffeescript2", function(conf) {
    var ERRORCLASS, commonConstants, commonKeywords, constants, dedent, delimiters, external, identifiers, indent, indentKeywords, keywords, longComment, operators, properties, regexPrefixes, stringPrefixes, tokenBase, tokenFactory, tokenLexer, wordOperators, wordRegexp;
    ERRORCLASS = "error";
    wordRegexp = function(words) {
      return new RegExp("^((" + words.join(")|(") + "))\\b");
    };
    operators = /^(?:->|=>|\+[+=]?|-[\-=]?|\*[\*=]?|\/[\/=]?|[=!]=|<[><]?=?|>>?=?|%[%=]?|&=?|\|=?|\^=?|\~|[\?:=!])/;
    delimiters = /^(?:[()\[\]{},`;]|\.\.?\.?)/;
    identifiers = /^[_A-Za-z$][_A-Za-z$0-9]*/;
    properties = /^(@|this\.)[_A-Za-z$]?[_A-Za-z$0-9]*/;
    wordOperators = wordRegexp(["and", "or", "not", "is", "isnt", "in", "instanceof", "typeof"]);
    indentKeywords = ["for", "while", "loop", "if", "unless", "else", "switch", "try", "catch", "finally", "class"];
    commonKeywords = ["break", "by", "continue", "debugger", "delete", "do", "in", "of", "new", "return", "then", "this", "throw", "when", "until", "->", "=>"];
    keywords = wordRegexp(indentKeywords.concat(commonKeywords));
    indentKeywords = wordRegexp(indentKeywords);
    stringPrefixes = /^('{3}|\"{3}|['\"])/;
    regexPrefixes = /^(\/{3}|\/)/;
    commonConstants = ["Infinity", "NaN", "undefined", "null", "true", "false", "on", "off", "yes", "no"];
    constants = wordRegexp(commonConstants);
    tokenBase = function(stream, state) {
      var ch, floatLiteral, intLiteral, lineOffset, scopeOffset;
      if (stream.sol()) {
        if (state.scope.align === null) {
          state.scope.align = false;
        }
        scopeOffset = state.scope.offset;
        if (stream.eatSpace()) {
          lineOffset = stream.indentation();
          if (lineOffset > scopeOffset && state.scope.type === "coffee") {
            return "indent";
          } else if (lineOffset < scopeOffset) {
            return "dedent";
          }
          return null;
        } else {
          if (scopeOffset > 0) {
            dedent(stream, state);
          }
        }
      }
      if (stream.eatSpace()) {
        return null;
      }
      ch = stream.peek();
      if (stream.match("####")) {
        stream.skipToEnd();
        return "comment";
      }
      if (stream.match("###")) {
        state.tokenize = longComment;
        return state.tokenize(stream, state);
      }
      if (ch === "#") {
        stream.skipToEnd();
        return "comment";
      }
      if (stream.match(/^-?[0-9\.]/, false)) {
        floatLiteral = false;
        if (stream.match(/^-?\d*\.\d+(e[\+\-]?\d+)?/i)) {
          floatLiteral = true;
        }
        if (stream.match(/^-?\d+\.\d*/)) {
          floatLiteral = true;
        }
        if (stream.match(/^-?\.\d+/)) {
          floatLiteral = true;
        }
        if (floatLiteral) {
          if (stream.peek() === ".") {
            stream.backUp(1);
          }
          return "number";
        }
        intLiteral = false;
        if (stream.match(/^-?0x[0-9a-f]+/i)) {
          intLiteral = true;
        }
        if (stream.match(/^-?[1-9]\d*(e[\+\-]?\d+)?/)) {
          intLiteral = true;
        }
        if (stream.match(/^-?0(?![\dx])/i)) {
          intLiteral = true;
        }
        if (intLiteral) {
          return "number";
        }
      }
      if (stream.match(stringPrefixes)) {
        state.tokenize = tokenFactory(stream.current(), false, "string");
        return state.tokenize(stream, state);
      }
      if (stream.match(regexPrefixes)) {
        if (stream.current() !== "/" || stream.match(/^.*\//, false)) {
          state.tokenize = tokenFactory(stream.current(), true, "string-2");
          return state.tokenize(stream, state);
        } else {
          stream.backUp(1);
        }
      }
      if (stream.match(operators) || stream.match(wordOperators)) {
        return "operator";
      }
      if (stream.match(delimiters)) {
        return "punctuation";
      }
      if (stream.match(constants)) {
        return "atom";
      }
      if (stream.match(keywords)) {
        return "keyword";
      }
      if (stream.match(identifiers)) {
        return "variable";
      }
      if (stream.match(properties)) {
        return "property";
      }
      stream.next();
      return ERRORCLASS;
    };
    tokenFactory = function(delimiter, singleline, outclass) {
      return function(stream, state) {
        while (!stream.eol()) {
          stream.eatWhile(/[^'"\/\\]/);
          if (stream.eat("\\")) {
            stream.next();
            if (singleline && stream.eol()) {
              return outclass;
            }
          } else if (stream.match(delimiter)) {
            state.tokenize = tokenBase;
            return outclass;
          } else {
            stream.eat(/['"\/]/);
          }
        }
        if (singleline) {
          if (conf.mode.singleLineStringErrors) {
            outclass = ERRORCLASS;
          } else {
            state.tokenize = tokenBase;
          }
        }
        return outclass;
      };
    };
    longComment = function(stream, state) {
      while (!stream.eol()) {
        stream.eatWhile(/[^#]/);
        if (stream.match("###")) {
          state.tokenize = tokenBase;
          break;
        }
        stream.eatWhile("#");
      }
      return "comment";
    };
    indent = function(stream, state, type) {
      var align, alignOffset, offset, scope;
      type = type || "coffee";
      offset = 0;
      align = false;
      alignOffset = null;
      scope = state.scope;
      while ((scope = scope.prev)) {
        if (scope.type === "coffee") {
          offset = scope.offset + conf.indentUnit;
          break;
        }
      }
      if (type !== "coffee") {
        align = null;
        alignOffset = stream.column() + stream.current().length;
      } else if (state.scope.align) {
        state.scope.align = false;
      }
      return state.scope = {
        offset: offset,
        type: type,
        prev: state.scope,
        align: align,
        alignOffset: alignOffset
      };
    };
    dedent = function(stream, state) {
      var matched, scope, _indent;
      if (!state.scope.prev) {
        return;
      }
      if (state.scope.type === "coffee") {
        _indent = stream.indentation();
        matched = false;
        scope = state.scope;
        while ((scope = scope.prev)) {
          if (_indent === scope.offset) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          return true;
        }
        while (state.scope.prev && state.scope.offset !== _indent) {
          state.scope = state.scope.prev;
        }
        return false;
      } else {
        state.scope = state.scope.prev;
        return false;
      }
    };
    tokenLexer = function(stream, state) {
      var current, delimiter_index, style;
      style = state.tokenize(stream, state);
      current = stream.current();
      if (current === ".") {
        style = state.tokenize(stream, state);
        current = stream.current();
        if (/^\.[\w$]+$/.test(current)) {
          return "variable";
        } else {
          return ERRORCLASS;
        }
      }
      if (current === "return") {
        state.dedent += 1;
      }
      if (((current === "->" || current === "=>") && !state.lambda && !stream.peek()) || style === "indent") {
        indent(stream, state);
      }
      delimiter_index = "[({".indexOf(current);
      if (delimiter_index !== -1) {
        indent(stream, state, "])}".slice(delimiter_index, delimiter_index + 1));
      }
      if (indentKeywords.exec(current)) {
        indent(stream, state);
      }
      if (current === "then") {
        dedent(stream, state);
      }
      if (style === "dedent") {
        if (dedent(stream, state)) {
          return ERRORCLASS;
        }
      }
      delimiter_index = "])}".indexOf(current);
      if (delimiter_index !== -1) {
        while (state.scope.type === "coffee" && state.scope.prev) {
          state.scope = state.scope.prev;
        }
        if (state.scope.type === current) {
          state.scope = state.scope.prev;
        }
      }
      if (state.dedent > 0 && stream.eol() && state.scope.type === "coffee") {
        if (state.scope.prev) {
          state.scope = state.scope.prev;
        }
        state.dedent -= 1;
      }
      return style;
    };
    external = {
      startState: function(basecolumn) {
        return {
          tokenize: tokenBase,
          scope: {
            offset: basecolumn || 0,
            type: "coffee",
            prev: null,
            align: false
          },
          lastToken: null,
          lambda: false,
          dedent: 0
        };
      },
      token: function(stream, state) {
        var fillAlign, style;
        fillAlign = state.scope.align === null && state.scope;
        if (fillAlign && stream.sol()) {
          fillAlign.align = false;
        }
        style = tokenLexer(stream, state);
        if (fillAlign && style && style !== "comment") {
          fillAlign.align = true;
        }
        state.lastToken = {
          style: style,
          content: stream.current()
        };
        if (stream.eol() && stream.lambda) {
          state.lambda = false;
        }
        return style;
      },
      indent: function(state, text) {
        var closer, closes, scope;
        if (state.tokenize !== tokenBase) {
          return 0;
        }
        scope = state.scope;
        closer = text && "])}".indexOf(text.charAt(0)) > -1;
        if (closer) {
          while (scope.type === "coffee" && scope.prev) {
            scope = scope.prev;
          }
        }
        closes = closer && scope.type === text.charAt(0);
        if (scope.align) {
          return scope.alignOffset - (closes != null ? closes : {
            1: 0
          });
        } else {
          return (closes ? scope.prev : scope).offset;
        }
      },
      lineComment: "#",
      fold: "indent"
    };
    return external;
  });

  CodeMirror.defineMIME("text/x-coffeescript", "coffeescript");

}).call(this);