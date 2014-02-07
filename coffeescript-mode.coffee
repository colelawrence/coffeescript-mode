CodeMirror.defineMode "coffeescript2", (conf)->
  ERRORCLASS = "error"

  wordRegexp = (words) ->
    return new RegExp("^((" + words.join(")|(") + "))\\b");

  operators = ///
    ^(
        ?: -> | => | \+[+=]? | -[\-=]?
        | \*[\*=]?  | /[/=]? | [=!]= 
        | <[><]?=?  | > >? =? | %[%=]?  | &=?
        | \|=?  | \^=?  | \~ | [\?:=!]
      )
  ///

  delimiters = ///
    ^(
        ?:  [()\[\]{},`;] | \.\.?\.?
      )
  ///
  identifiers = ///
    ^[_A-Za-z$][_A-Za-z$0-9]*
  ///
  properties = ///
    ^(@|this\.)[_A-Za-z$]?[_A-Za-z$0-9]*
  ///

  wordOperators = wordRegexp(["and", "or", "not",
                              "is", "isnt", "in",
                              "instanceof", "typeof"]);
  indentKeywords = ["for", "while", "loop", "if", "unless", "else",
                    "switch", "try", "catch", "finally", "class"];
  commonKeywords = ["break", "by", "continue", "debugger", "delete",
                    "do", "in", "of", "new", "return", "then",
                    "this", "throw", "when", "until", "->", "=>"];

  keywords = wordRegexp(indentKeywords.concat(commonKeywords));

  indentKeywords = wordRegexp(indentKeywords);


  stringPrefixes = /^('{3}|\"{3}|['\"])/;
  regexPrefixes = /^(\/{3}|\/)/;
  commonConstants = ["Infinity", "NaN", "undefined", "null", "true", "false", "on", "off", "yes", "no"];
  constants = wordRegexp(commonConstants);

  # Tokenizers
  tokenBase = (stream, state) ->
    # Handle scope changes
    if(stream.sol())
      if (state.scope.align is null)
        state.scope.align = false;
      scopeOffset = state.scope.offset;
      if(stream.eatSpace())
        lineOffset = stream.indentation();
        if (lineOffset > scopeOffset && state.scope.type == "coffee")
          return "indent";
        else if (lineOffset < scopeOffset)
          return "dedent";
        return null;
      else
        if (scopeOffset > 0)
          dedent(stream, state);
    if (stream.eatSpace())
      return null;

    ch = stream.peek();

    # Handle docco title comment (single line)
    if (stream.match("####"))
      stream.skipToEnd();
      return "comment";

    # Handle multi line comments
    if (stream.match("###"))
      state.tokenize = longComment;
      return state.tokenize(stream, state);

    # Single line comment
    if (ch is "#")
      stream.skipToEnd();
      return "comment";

    # Handle number literals
    if(stream.match(/^-?[0-9\.]/, false))
      floatLiteral = false;
      # Floats
      if (stream.match(/^-?\d*\.\d+(e[\+\-]?\d+)?/i))
        floatLiteral = true;

      if (stream.match(/^-?\d+\.\d*/))
        floatLiteral = true;

      if (stream.match(/^-?\.\d+/))
        floatLiteral = true;

      if (floatLiteral)
        # prevent from getting extra . on 1..
        if (stream.peek() == ".")
          stream.backUp(1);
        return "number";

      # Integers
      intLiteral = false;
      # Hex
      if (stream.match(/^-?0x[0-9a-f]+/i))
        intLiteral = true;

      # Decimal
      if (stream.match(/^-?[1-9]\d*(e[\+\-]?\d+)?/))
        intLiteral = true;

      # Zero by itself with no other piece of number.
      if (stream.match(/^-?0(?![\dx])/i))
        intLiteral = true;

      if (intLiteral)
        return "number"

    # Handle strings
    if (stream.match(stringPrefixes))
      state.tokenize = tokenFactory(stream.current(), false, "string");
      return state.tokenize(stream, state);

    # Handle regex literals
    if (stream.match(regexPrefixes))
      if (stream.current() != "/" || stream.match(/^.*\//, false)) # prevent highlight of division
        state.tokenize = tokenFactory(stream.current(), true, "string-2");
        return state.tokenize(stream, state);
      else
        stream.backUp(1);

    # Handle operators and delimiters
    if (stream.match(operators) || stream.match(wordOperators))
      return "operator";

    if (stream.match(delimiters))
      return "punctuation";

    if (stream.match(constants))
      return "atom";

    if (stream.match(keywords))
      return "keyword";

    if (stream.match(identifiers))
      return "variable";

    if (stream.match(properties))
      return "property";


    # Handle non-detected items
    stream.next();
    return ERRORCLASS;

  tokenFactory = (delimiter, singleline, outclass) -> 
    (stream, state) ->
      while (!stream.eol())
        stream.eatWhile(/[^'"\/\\]/);
        if (stream.eat("\\"))
          stream.next();
          if (singleline && stream.eol())
            return outclass;

        else if (stream.match(delimiter))
          state.tokenize = tokenBase;
          return outclass;
        else
          stream.eat(/['"\/]/);

      if singleline
        if (conf.mode.singleLineStringErrors)
          outclass = ERRORCLASS;
        else
          state.tokenize = tokenBase;
      return outclass;

  longComment = (stream, state)->
    while (!stream.eol())
      stream.eatWhile(/[^#]/);
      if (stream.match("###"))
        state.tokenize = tokenBase;
        break;

      stream.eatWhile("#");

    return "comment";

  indent = (stream, state, type) ->
    type = type || "coffee"
    offset = 0
    align = false
    alignOffset = null
    
    scope = state.scope
    while(scope = scope.prev)
      if (scope.type is "coffee")
        offset = scope.offset + conf.indentUnit;
        break;

    if (type isnt "coffee")
      align = null;
      alignOffset = stream.column() + stream.current().length;
    else if (state.scope.align)
      state.scope.align = false;

    state.scope =
      offset: offset,
      type: type,
      prev: state.scope,
      align: align,
      alignOffset: alignOffset

  dedent = (stream, state) ->
    if (!state.scope.prev)
      return;
    if (state.scope.type is "coffee")
      _indent = stream.indentation();
      matched = false;
      scope = state.scope
      while(scope = scope.prev)
        if (_indent is scope.offset)
          matched = true;
          break;

      if (!matched)
        return true;

      while (state.scope.prev && state.scope.offset isnt _indent)
        state.scope = state.scope.prev;

      return false;
    else
      state.scope = state.scope.prev;
      return false;

  tokenLexer = (stream, state) ->
    style = state.tokenize(stream, state);
    current = stream.current();

    # Handle "." connected identifiers
    if (current is ".")
      style = state.tokenize(stream, state);
      current = stream.current();
      if (/^\.[\w$]+$/.test(current))
        return "variable";
      else
        return ERRORCLASS;

    # Handle scope changes.
    if (current is "return")
      state.dedent += 1;

    if (((current is "->" || current is "=>") and
        !state.lambda and
        !stream.peek()) or
        style is "indent")
      indent(stream, state);

    delimiter_index = "[({".indexOf(current);
    if (delimiter_index isnt -1)
      indent(stream, state, "])}".slice(delimiter_index, delimiter_index+1));

    if (indentKeywords.exec(current))
      indent(stream, state);

    if (current is "then")
      dedent(stream, state);

    if (style is "dedent") 
      if (dedent(stream, state))
        return ERRORCLASS;


    delimiter_index = "])}".indexOf(current)
    if (delimiter_index isnt -1)
      while (state.scope.type == "coffee" && state.scope.prev)
        state.scope = state.scope.prev;
      if (state.scope.type == current)
        state.scope = state.scope.prev;

    if(state.dedent > 0 and stream.eol() and state.scope.type is "coffee")
      if (state.scope.prev)
        state.scope = state.scope.prev
      state.dedent -= 1;

    return style

  external = {
    startState: (basecolumn)->
      return {
        tokenize: tokenBase,
        scope: {offset:basecolumn || 0, type:"coffee", prev: null, align: false},
        lastToken: null,
        lambda: false,
        dedent: 0
      };

    token: (stream, state)->
      fillAlign = state.scope.align is null && state.scope;
      if (fillAlign && stream.sol())
        fillAlign.align = false;

      style = tokenLexer(stream, state);
      if (fillAlign && style && style != "comment")
        fillAlign.align = true;

      state.lastToken = {style:style, content: stream.current()};

      if (stream.eol() && stream.lambda)
        state.lambda = false;

      return style;

    indent: (state, text)->
      return 0 if (state.tokenize != tokenBase)
      scope = state.scope;
      closer = text && "])}".indexOf(text.charAt(0)) > -1;
      if (closer)
        while (scope.type == "coffee" && scope.prev)
          scope = scope.prev
      closes = closer && scope.type is text.charAt(0);
      if (scope.align)
        return scope.alignOffset - (closes ? 1 : 0);
      else
        return (if closes then scope.prev else scope).offset;
  
    lineComment: "#"
    fold: "indent"
  }
  return external;

CodeMirror.defineMIME("text/x-coffeescript", "coffeescript")