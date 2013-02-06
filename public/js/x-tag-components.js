if (!(document.register || {}).__polyfill__){

  (function(){
    
    var win = window,
      doc = document,
      tags = {},
      tokens = [],
      domready = false,
      mutation = win.MutationObserver || win.WebKitMutationObserver ||  win.MozMutationObserver,
      _createElement = doc.createElement,
      register = function(name, options){
        if (!tags[name]) tokens.push(name);
        options = options || {};
        if (options.prototype && !('setAttribute' in options.prototype)) {
          throw new TypeError("Unexpected prototype for " + name + " element - custom element prototypes must inherit from the Element interface");
        }
        var lifecycle = options.lifecycle || {},
            tag = tags[name] = {
              'constructor': function(){
                return doc.createElement(name);
              },
              'prototype': options.prototype || Object.create((win.HTMLSpanElement || win.HTMLElement).prototype),
              'fragment': options.fragment || doc.createDocumentFragment(),
              'lifecycle': {
                created: lifecycle.created || function(){},
                removed: lifecycle.removed || function(){},
                inserted: lifecycle.inserted || function(){},
                attributeChanged: lifecycle.attributeChanged || function(){}
              }
            };
        tag.constructor.prototype = tag.prototype;
        if (domready) query(doc, name).forEach(function(element){
          upgrade(element, true);
        });
        return tag.constructor;
      };
    
    function typeOf(obj) {
      return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    }
    
    function clone(item, type){
      var fn = clone[type || typeOf(item)];
      return fn ? fn(item) : item;
    }
      clone.object = function(src){
        var obj = {};
        for (var key in src) obj[key] = clone(src[key]);
        return obj;
      };
      clone.array = function(src){
        var i = src.length, array = new Array(i);
        while (i--) array[i] = clone(src[i]);
        return array;
      };
    
    var unsliceable = ['number', 'boolean', 'string', 'function'];
    function toArray(obj){
      return unsliceable.indexOf(typeof obj) == -1 ? 
      Array.prototype.slice.call(obj, 0) :
      [obj];
    }
    
    function query(element, selector){
      return element && selector && selector.length ? toArray(element.querySelectorAll(selector)) : [];
    }
    
    function getTag(element){
      return element.nodeName ? tags[element.nodeName.toLowerCase()] : false;
    }
    
    function manipulate(element, fn){
      var next = element.nextSibling,
        parent = element.parentNode,
        frag = doc.createDocumentFragment(),
        returned = fn.call(frag.appendChild(element), frag) || element;
      if (next){
        parent.insertBefore(returned, next);
      }
      else{
        parent.appendChild(returned);
      }
    }
    
    function upgrade(element, replace){
      if (!element._elementupgraded && !element._suppressObservers) {
        var tag = getTag(element);
        if (tag) {
          var upgraded = element;
          if (replace) {
            element._suppressObservers = true;
            manipulate(element, function(){
              upgraded = _createElement.call(doc, element.nodeName);
              upgraded._suppressObservers = true;
              while (element.firstChild) upgraded.appendChild(element.firstChild);
              var index = element.attributes.length;
              while (index--) {
                var attr = element.attributes[index];
                upgraded.setAttribute(attr.name, attr.value);
              }
              return upgraded;
            });
          }
          upgraded.__proto__ = tag.prototype;
          upgraded.constructor = tag.constructor;
          upgraded._elementupgraded = true;
          if (!mutation) delete upgraded._suppressObservers;
          tag.lifecycle.created.call(upgraded, tag.prototype);
          if (replace) fireEvent(element, 'elementreplace', { upgrade: upgraded }, { bubbles: false });
          fireEvent(upgraded, 'elementupgrade');
        }
      }
    }
    
    function inserted(element, event){
      var tag = getTag(element);
      if (tag){
        if (!element._elementupgraded) upgrade(element, true);
        else {
          if (element._suppressObservers) {
            delete element._suppressObservers;
            return element;
          }
          if (!element._suppressObservers && doc.documentElement.contains(element)) {
            tag.lifecycle.inserted.call(element);
          }
          insertChildren(element);
        }
      }
      else insertChildren(element);
    }

    function insertChildren(element){
      if (element.childNodes.length) query(element, tokens).forEach(function(el){
        if (!el._elementupgraded) upgrade(el, true);
        getTag(el).lifecycle.inserted.call(el);
      });
    }
    
    function removed(element){
      if (element._elementupgraded) {
        if (element._suppressObservers) delete element._suppressObservers;
        else {
          getTag(element).lifecycle.removed.call(element);
          if (element.childNodes.length) query(element, tokens).forEach(function(el){
            removed(el);
          });
        }
      }
    }
    
    function addObserver(element, type, fn){
      if (!element._records) {
        element._records = { inserted: [], removed: [] };
        if (mutation){
          element._observer = new mutation(function(mutations) {
            parseMutations(element, mutations);
          });
          element._observer.observe(element, {
            subtree: true,
            childList: true,
            attributes: !true,
            characterData: false
          });
        }
        else ['Inserted', 'Removed'].forEach(function(type){
          element.addEventListener('DOMNode' + type, function(event){
            event._mutation = true;
            element._records[type.toLowerCase()].forEach(function(fn){
              fn(event.target, event);
            });
          }, false);
        });
      }
      if (element._records[type].indexOf(fn) == -1) element._records[type].push(fn);
    }
    
    function removeObserver(element, type, fn){
      var obj = element._records;
      if (obj && fn){
        obj[type].splice(obj[type].indexOf(fn), 1);
      }
      else{
        obj[type] = [];
      }
    }
      
    function parseMutations(element, mutations) {
      var diff = { added: [], removed: [] };
      mutations.forEach(function(record){
        record._mutation = true;
        for (var z in diff) {
          var type = element._records[(z == 'added') ? 'inserted' : 'removed'],
            nodes = record[z + 'Nodes'], length = nodes.length;
          for (i = 0; i < length && diff[z].indexOf(nodes[i]) == -1; i++){
            diff[z].push(nodes[i]);
            type.forEach(function(fn){
              fn(nodes[i], record);
            });
          }
        }
      });
    }
      
    function fireEvent(element, type, data, options){
      options = options || {};
      var event = doc.createEvent('Event');
      event.initEvent(type, 'bubbles' in options ? options.bubbles : true, 'cancelable' in options ? options.cancelable : true);
      for (var z in data) event[z] = data[z];
      element.dispatchEvent(event);
    }

    var polyfill = !doc.register;
    if (polyfill) {
      doc.register = register;
      
      doc.createElement = function createElement(tag){
        var element = _createElement.call(doc, tag);
        upgrade(element);
        return element;
      };
      
      var _setAttribute = Element.prototype.setAttribute;   
      Element.prototype.setAttribute = function(attr, value){
        var tag = getTag(this),
            last = this.getAttribute(attr);
        _setAttribute.call(this, attr, value);
        if (tag && last != this.getAttribute(attr)) {
          tag.lifecycle.attributeChanged.call(this, attr, value, last);
        } 
      };
      
      var initialize = function (){
        addObserver(doc.documentElement, 'inserted', inserted);
        addObserver(doc.documentElement, 'removed', removed);
        
        if (tokens.length) query(doc, tokens).forEach(function(element){
          upgrade(element, true);
        });
        
        domready = true;
        fireEvent(doc, 'DOMComponentsLoaded');
        fireEvent(doc, '__DOMComponentsLoaded__');
      };
      
      if (doc.readyState == 'complete') initialize();
      else doc.addEventListener(doc.readyState == 'interactive' ? 'readystatechange' : 'DOMContentLoaded', initialize); 
    }
    
    doc.register.__polyfill__ = {
      query: query,
      clone: clone,
      typeOf: typeOf,
      toArray: toArray,
      fireEvent: fireEvent,
      manipulate: manipulate,
      addObserver: addObserver,
      removeObserver: removeObserver,
      observerElement: doc.documentElement,
      parseMutations: parseMutations,
      _inserted: inserted,
      _createElement: _createElement,
      _polyfilled: polyfill
    };

  })();

}

(function () {

/*** Internal Variables ***/

  var win = window,
    doc = document,
    keypseudo = {
      action: function (pseudo, event) {
        return ~pseudo.value.match(/(\d+)/g).indexOf(String(event.keyCode)) == (pseudo.name == 'keypass');
      }
    },
    touchFilter = function (custom, event) {
      if (custom.listener.touched) return custom.listener.touched = false;
      else {
        if (event.type.match('touch')) custom.listener.touched = true;
      }
    },
    createFlowEvent = function (type) {
      var flow = type == 'over';
      return {
        base: 'OverflowEvent' in window ? 'overflowchanged' : type + 'flow',
        condition: function (custom, event) {
          return event.type == (type + 'flow') ||
          ((event.orient === 0 && event.horizontalOverflow == flow) ||
          (event.orient == 1 && event.verticalOverflow == flow) ||
          (event.orient == 2 && event.horizontalOverflow == flow && event.verticalOverflow == flow));
        }
      };
    },
    prefix = (function () {
      var styles = win.getComputedStyle(doc.documentElement, ''),
        pre = (Array.prototype.slice
          .call(styles)
          .join('') 
          .match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
        )[1],
        dom = ('WebKit|Moz|MS|O').match(new RegExp('(' + pre + ')', 'i'))[1];
      return {
        dom: dom,
        lowercase: pre,
        css: '-' + pre + '-',
        js: pre[0].toUpperCase() + pre.substr(1)
      };

    })(),
    matchSelector = Element.prototype.matchesSelector || Element.prototype[prefix.lowercase + 'MatchesSelector'];
  
/*** Internal Functions ***/

  // Mixins
  
  function mergeOne(source, key, current){
    var type = xtag.typeOf(current);
    if (type == 'object' && xtag.typeOf(source[key]) == 'object') xtag.merge(source[key], current);
    else source[key] = xtag.clone(current, type);
    return source;
  }
  
  function mergeMixin(type, mixin, option) {
    var original = {};
    for (var o in option) original[o.split(':')[0]] = true;
    for (var x in mixin) if (!original[x.split(':')[0]]) option[x] = mixin[x];
  }

  function applyMixins(tag) {
    tag.mixins.forEach(function (name) {
      var mixin = xtag.mixins[name];
      for (var type in mixin) {
        switch (type) {
          case 'lifecycle': case 'methods':
            mergeMixin(type, mixin[type], tag[type]);
            break;
          case 'accessors': case 'prototype':
            for (var z in mixin[type]) mergeMixin(z, mixin[type], tag.accessors);
            break;
          case 'events':
            break;
        }
      }
    });
    return tag;
  }
  
/*** X-Tag Object Definition ***/

  var xtag = {
    defaultOptions: {
      mixins: [],
      events: {},
      methods: {},
      accessors: {},
      lifecycle: {},
      'prototype': {
        xtag: {
          get: function(){
            return this.__xtag__ ? this.__xtag__ : (this.__xtag__ = { data: {} });
          },
          set: function(){
            
          }
        }
      }
    },
    register: function (name, options) {
      var tag = xtag.merge({}, xtag.defaultOptions, options);
      tag = applyMixins(tag);
      for (var z in tag.events) tag.events[z.split(':')[0]] = xtag.parseEvent(z, tag.events[z]);
      for (z in tag.lifecycle) tag.lifecycle[z.split(':')[0]] = xtag.applyPseudos(z, tag.lifecycle[z]);
      for (z in tag.methods) tag.prototype[z.split(':')[0]] = { value: xtag.applyPseudos(z, tag.methods[z]) };
      
      for (var prop in tag.accessors) {
        tag.prototype[prop] = {};
        var accessor = tag.accessors[prop];
        for (z in accessor) {
          var key = z.split(':'), type = key[0];
          if (type == 'get' || type == 'set') {
            key[0] = prop;
            tag.prototype[prop][type] = xtag.applyPseudos(key.join(':'), accessor[z]);
          }
          else tag.prototype[prop][z] = accessor[z];
        }
      }

      var created = tag.lifecycle.created;
      tag.lifecycle.created = function () {
        xtag.addEvents(this, tag.events);
        tag.mixins.forEach(function(mixin){
          if (xtag.mixins[mixin].events) xtag.addEvents(this, xtag.mixins[mixin].events);
        },this);
        return created ? created.apply(this, xtag.toArray(arguments)) : null;
      };
      
      var proto = doc.register(name, {
        'prototype': 'nodeName' in tag.prototype ? tag.prototype : Object.create((win.HTMLSpanElement || win.HTMLElement).prototype, tag.prototype),
        'lifecycle':  tag.lifecycle
      });

      return proto;
    },

  /*** Exposed Variables ***/
    mixins: {},
    prefix: prefix,
    captureEvents: ['focus', 'blur'],
    customEvents: {
      overflow: createFlowEvent('over'),
      underflow: createFlowEvent('under'),
      animationstart: {
        base: [
          'animationstart',
          'oAnimationStart',
          'MSAnimationStart',
          'webkitAnimationStart'
        ]
      },
      transitionend: {
        base: [
          'transitionend',
          'oTransitionEnd',
          'MSTransitionEnd',
          'webkitTransitionEnd'
        ]
      },
      tap: {
        base: ['click', 'touchend'],
        condition: touchFilter
      },
      tapstart: {
        base: ['mousedown', 'touchstart'],
        condition: touchFilter
      },
      tapend: {
        base: ['mouseup', 'touchend'],
        condition: touchFilter
      },
      tapenter: {
        base: ['mouseover', 'touchenter'],
        condition: touchFilter
      },
      tapleave: {
        base: ['mouseout', 'touchleave'],
        condition: touchFilter
      },
      tapmove: {
        base: ['mousemove', 'touchmove'],
        condition: touchFilter
      }
    },
    pseudos: {
      keypass: keypseudo,
      keyfail: keypseudo,
      delegate: {
        action: function (pseudo, event) {
          var target = xtag.query(this, pseudo.value).filter(function (node) {
          return node == event.target ||
            node.contains ? node.contains(event.target) : false;
          })[0];
          return target ? pseudo.listener = pseudo.listener.bind(target) : false;
        }
      },
      preventable: {
        action: function (pseudo, event) {
          return !event.defaultPrevented;
        }
      },
      attribute: {
        action: function (pseudo, value) {
          this.setAttribute(pseudo.value || pseudo.key.split(':')[0], value, true);
        }
      }
    },

  /*** Utilities ***/

    // JS Types
    
    wrap: function (original, fn) {
      return function () {
        var args = xtag.toArray(arguments),
          returned = original.apply(this, args);
        return returned === false ? false : fn.apply(this, typeof returned != 'undefined' ? xtag.toArray(returned) : args);
      };
    },
    
    merge: function(source, k, v){
      if (xtag.typeOf(k) == 'string') return mergeOne(source, k, v);
      for (var i = 1, l = arguments.length; i < l; i++){
        var object = arguments[i];
        for (var key in object) mergeOne(source, key, object[key]);
      }
      return source;
    },

    skipTransition: function(element, fn, bind){
      var duration = prefix.js + 'TransitionDuration';
      element.style[duration] = '0.001s';
      fn.call(bind);
      xtag.addEvent(element, 'transitionend', function(){
        element.style[duration] = '';
      });
    },

    // DOM
    matchSelector: function (element, selector) {
      return matchSelector.call(element, selector);
    },
    
    innerHTML: function (element, html) {
      element.innerHTML = html;
      if (xtag._polyfilled) {
        if (xtag.observerElement._observer) {
          xtag.parseMutations(xtag.observerElement, xtag.observerElement._observer.takeRecords());
        }
        else xtag._inserted(element);
      }
    },

    hasClass: function (element, klass) {
      return element.className.split(' ').indexOf(klass.trim())>-1;
    },

    addClass: function (element, klass) {
      var list = element.className.trim().split(' ');
      klass.trim().split(' ').forEach(function (name) {
        if (!~list.indexOf(name)) list.push(name);
      });
      element.className = list.join(' ').trim();
      return element;
    },

    removeClass: function (element, klass) {
      var classes = klass.trim().split(' ');
      element.className = element.className.trim().split(' ').filter(function (name) {
        return name && !~classes.indexOf(name);
      }).join(' ');
      return element;
    },
    toggleClass: function (element, klass) {
      return xtag[xtag.hasClass(element, klass) ? 'removeClass' : 'addClass'].call(null, element, klass);

    },
    query: function (element, selector) {
      return xtag.toArray(element.querySelectorAll(selector));
    },

    queryChildren: function (element, selector) {
      var id = element.id,
        guid = element.id = id || 'x_' + new Date().getTime(),
        attr = '#' + guid + ' > ';
      selector = attr + (selector + '').replace(',', ',' + attr, 'g');
      var result = element.parentNode.querySelectorAll(selector);
      if (!id) element.id = null;
      return xtag.toArray(result);
    },

    createFragment: function (content) {
      var frag = doc.createDocumentFragment();
      if (content) {
        var div = frag.appendChild(doc.createElement('div')),
          nodes = xtag.toArray(content.nodeName ? arguments : !(div.innerHTML = content) || div.children),
          index = nodes.length;
        while (index--) frag.insertBefore(nodes[index], div);
        frag.removeChild(div);
      }
      return frag;
    },

  /*** Pseudos ***/

    applyPseudos: function (key, fn) {
      var listener = fn;
      if (key.match(':')) {
        var split = key.match(/(\w+(?:\([^\)]+\))?)/g),
            i = split.length;
        while (--i) {
          split[i].replace(/(\w*)(?:\(([^\)]*)\))?/, function (match, name, value) {
            var pseudo = xtag.pseudos[name];
            if (!pseudo) throw "pseudo not found: " + name;
            var last = listener;
            listener = function(){
              var args = xtag.toArray(arguments),
                  obj = {
                    key: key,
                    name: name,
                    value: value,
                    listener: last
                  };
              if (pseudo.action.apply(this, [obj].concat(args)) === false) return false;
              return obj.listener.apply(this, args);
            };
          });
        }
      }
      return listener;
    },

  /*** Events ***/

    parseEvent: function (type, fn) {
      var pseudos = type.split(':'),
        key = pseudos.shift(),
        event = xtag.merge({
          base: key,
          pseudos: '',
          onAdd: function(){},
          onRemove: function(){},
          condition: function(){}
        }, xtag.customEvents[key] || {});
      event.type = key + (event.pseudos.length ? ':' + event.pseudos : '') + (pseudos.length ? ':' + pseudos.join(':') : '');
      if (fn) {
        var chained = xtag.applyPseudos(event.type, fn);
        event.listener = function(){
          var args = xtag.toArray(arguments);
          if (event.condition.apply(this, [event].concat(args)) === false) return false;
          return chained.apply(this, args);
        };
      }
      return event;
    },

    addEvent: function (element, type, fn) {
      var event = typeof fn == 'function' ? xtag.parseEvent(type, fn) : fn;
      event.onAdd.call(element, event, event.listener);
      xtag.toArray(event.base).forEach(function (name) {
        element.addEventListener(name, event.listener, xtag.captureEvents.indexOf(name) > -1);
      });
      return event.listener;
    },

    addEvents: function (element, events) {
      for (var z in events) xtag.addEvent(element, z, events[z]);
    },

    removeEvent: function (element, type, fn) {
      var event = xtag.parseEvent(type);
      event.onRemove.call(element, event, fn);
      xtag.removePseudos(element, event.type, fn);
      xtag.toArray(event.base).forEach(function (name) {
        element.removeEventListener(name, fn);
      });
    }
  };
  
  xtag.typeOf = doc.register.__polyfill__.typeOf;
  xtag.clone = doc.register.__polyfill__.clone;
  xtag.merge(xtag, doc.register.__polyfill__);

  if (typeof define == 'function' && define.amd) define(xtag);
  else win.xtag = xtag;

})();

(function(){  

var anchor = document.createElement('a');
anchor.href = '';

  function request(element, options){
    clearRequest(element);
    var last = element.xtag.request || {};
    element.xtag.request = options;
    var request = element.xtag.request,
      callbackKey = element.getAttribute('data-callback-key') ||
        'callback' + '=xtag.callbacks.';
    if (xtag.fireEvent(element, 'beforerequest') === false) return false;
    if (last.url && !options.update && 
      last.url.replace(new RegExp('\&?\(' + callbackKey + 'x[0-9]+)'), '') ==
        element.xtag.request.url){
      element.xtag.request = last;
      return false;
    }
    element.setAttribute('src', element.xtag.request.url);
    anchor.href = options.url;
    if (anchor.hostname == window.location.hostname) {
      request = xtag.merge(new XMLHttpRequest(), request);
      request.onreadystatechange = function(){
        element.setAttribute('data-readystate', request.readyState);
        if (request.readyState == 4 && request.status < 400){
          requestCallback(element, request);
        }
      };
      ['error', 'abort', 'load'].forEach(function(type){
        request['on' + type] = function(event){
          event.request = request;
          xtag.fireEvent(element, type, event);
        }
      });
      request.open(request.method , request.url, true);
      request.setRequestHeader('Content-Type', 
        'application/x-www-form-urlencoded');
      request.send();
    }
    else {
      var callbackID = request.callbackID = 'x' + new Date().getTime();
      element.setAttribute('data-readystate', request.readyState = 0);
      xtag.callbacks[callbackID] = function(data){
        request.status = 200;
        request.readyState = 4;
        request.responseText = data;
        requestCallback(element, request);
        delete xtag.callbacks[callbackID];
        clearRequest(element);
      }
      request.script = document.createElement('script');
      request.script.type = 'text/javascript';
      request.script.src = options.url = options.url + 
        (~options.url.indexOf('?') ? '&' : '?') + callbackKey + callbackID;
      request.script.onerror = function(error){
        element.setAttribute('data-readystate', request.readyState = 4);
        element.setAttribute('data-requeststatus', request.status = 400);
        xtag.fireEvent(element, 'error', error);
      }
      head.appendChild(request.script);
    }
    element.xtag.request = request;
  }
      
  function requestCallback(element, request){
    if (request != element.xtag.request) return xtag;
    element.setAttribute('data-readystate', request.readyState);
    element.setAttribute('data-requeststatus', request.status);         
    xtag.fireEvent(element, 'dataready', { request: request });
    if (element.dataready) element.dataready.call(element, request);
  }

  function clearRequest(element){
    var req = element.xtag.request;
    if (!req) return xtag;
    if (req.script && ~xtag.toArray(head.children).indexOf(req.script)) {
      head.removeChild(req.script);
    }
    else if (req.abort) req.abort();
  }


  xtag.mixins['request'] = {
    lifecycle:{
      created:  function(){        
        this.src = this.getAttribute('src');
      }
    },
    accessors:{
      dataready:{
        get: function(){
          return this.xtag.dataready;
        },
        set: function(fn){
          this.xtag.dataready = fn;
        }
      },
      src:{
        set: function(src){
          if (src){
            this.setAttribute('src', src);
            request(this, { url: src, method: 'GET' });
          }
        },
        get: function(){
          return this.getAttribute('src');
        }
      }
    }
  };

})();

(function(){

  xtag.register('x-growbox', {
    lifecycle: {
      created: function(){
        var children = xtag.toArray(this.children);
        this.innerHTML = this.template;
        xtag.addEvent(this.firstElementChild.firstElementChild.nextElementSibling, 'overflow', this.matchDimensions.bind(this));
        xtag.addEvent(this.firstElementChild.lastElementChild, 'underflow', this.matchDimensions.bind(this));
        children.forEach(function(el){
          this.appendChild(el);
        }, this.firstElementChild.firstElementChild);
        this.matchDimensions();
      }
    },
    prototype: {
      template: {
      value: '<div class="x-grow-wrap" onresize="(this.parentNode.matchDimensions || function(){})(true)">' +
        '<div class="x-grow-content"></div>' +
        '<div class="x-grow-overflow"><div></div></div>' +
        '<div class="x-grow-underflow"><div></div></div>' +
      '</div>'
      }
    },
    methods: {
      matchDimensions: function(resize){
        var wrap = this.firstElementChild;
        if (!wrap || wrap.className != 'x-grow-wrap') return false;
        this.style.height = (resize === true) ? window.getComputedStyle(wrap).height : wrap.scrollHeight + 'px';
        wrap.firstElementChild.nextElementSibling.firstChild.style.height = wrap.scrollHeight - 1 + 'px';
        wrap.lastElementChild.firstChild.style.height = wrap.scrollHeight + 1 + 'px';
      }
    },
    events:{
      'overflow': function(){
        this.matchDimensions();
      },
      'underflow': function(){
        this.matchDimensions();
      }
    }
  });

})();

(function(){

  var transform = xtag.prefix.js + 'Transform';
  function getState(el){
    var selected = xtag.query(el, 'x-slides > x-slide[selected]')[0] || 0;
    return [selected ? xtag.query(el, 'x-slides > x-slide').indexOf(selected) : selected, el.firstElementChild.children.length - 1];
  }

  function slide(el, index){
    var slides = xtag.toArray(el.firstElementChild.children);
    slides.forEach(function(slide){ slide.removeAttribute('selected'); });
    slides[index || 0].setAttribute('selected', null);
    el.firstElementChild.style[transform] = 'translate'+ (el.getAttribute('orientation') || 'x') + '(' + (index || 0) * (-100 / slides.length) + '%)';
  }

  function init(toSelected){    
    var slides = this.firstElementChild;
    if (!slides || !slides.children.length || slides.tagName.toLowerCase() != 'x-slides') return;
    
    var children = xtag.toArray(slides.children),
      size = 100 / (children.length || 1),
      orient = this.getAttribute('orientation') || 'x',
      style = orient == 'x' ? ['width', 'height'] : ['height', 'width'];
    
    slides.style[style[1]] =  '100%';
    slides.style[style[0]] = children.length * 100 + '%';
    slides.style[transform] = 'translate' + orient + '(0%)';
    children.forEach(function(slide){       
      slide.style[style[0]] = size + '%';
      slide.style[style[1]] = '100%';
    });    
    
    if (toSelected) {
      var selected = slides.querySelector('[selected]');
      if (selected) slide(this, children.indexOf(selected) || 0);
    }
  }

  xtag.register('x-slidebox', {
    events:{
      'transitionend': function(e){
        if (e.target == this) xtag.fireEvent(this, 'slideend');
      },
      'elementupgrade': function(e){
        if (e.target == this){
          init();
        }
      }
    },
    accessors:{
      orientation:{
        get: function(){
          return this.getAttribute('orientation');
        },
        set: function(value){
          this.setAttribute('orientation', value.toLowerCase());
          init.call(this, true);
        }
      }
    },
    methods: {
      slideTo: function(index){
        slide(this, index);
      },
      slideNext: function(){
        var shift = getState(this);
          shift[0]++;
        slide(this, shift[0] > shift[1] ? 0 : shift[0]);
      },
      slidePrevious: function(){
        var shift = getState(this);
          shift[0]--;
        slide(this, shift[0] < 0 ? shift[1] : shift[0]);
      }
    }
  });
  
  xtag.register('x-slide', {
    lifecycle:{
      inserted: function(){
        var ancestor = this.parentNode.parentNode;
        if (ancestor.tagName.toLowerCase() == 'x-slidebox') init.call(ancestor, true);
      }
    },
    events:{
      'elementupgrade': function(e){
        if (e.target == this){
          var ancestor = this.parentNode.parentNode;
          if (ancestor.tagName.toLowerCase() == 'x-slidebox') init.call(ancestor, true);
        }
      }
    }
  });
  
})();
/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */(function(){var e=/\blang(?:uage)?-(?!\*)(\w+)\b/i,t=self.Prism={util:{type:function(e){return Object.prototype.toString.call(e).match(/\[object (\w+)\]/)[1]},clone:function(e){var n=t.util.type(e);switch(n){case"Object":var r={};for(var i in e)e.hasOwnProperty(i)&&(r[i]=t.util.clone(e[i]));return r;case"Array":return e.slice()}return e}},languages:{extend:function(e,n){var r=t.util.clone(t.languages[e]);for(var i in n)r[i]=n[i];return r},insertBefore:function(e,n,r,i){i=i||t.languages;var s=i[e],o={};for(var u in s)if(s.hasOwnProperty(u)){if(u==n)for(var a in r)r.hasOwnProperty(a)&&(o[a]=r[a]);o[u]=s[u]}return i[e]=o},DFS:function(e,n){for(var r in e){n.call(e,r,e[r]);t.util.type(e)==="Object"&&t.languages.DFS(e[r],n)}}},highlightAll:function(e,n){var r=document.querySelectorAll('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code');for(var i=0,s;s=r[i++];)t.highlightElement(s,e===!0,n)},highlightElement:function(r,i,s){var o,u,a=r;while(a&&!e.test(a.className))a=a.parentNode;if(a){o=(a.className.match(e)||[,""])[1];u=t.languages[o]}if(!u)return;r.className=r.className.replace(e,"").replace(/\s+/g," ")+" language-"+o;a=r.parentNode;/pre/i.test(a.nodeName)&&(a.className=a.className.replace(e,"").replace(/\s+/g," ")+" language-"+o);var f=r.textContent;if(!f)return;f=f.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\u00a0/g," ");var l={element:r,language:o,grammar:u,code:f};t.hooks.run("before-highlight",l);if(i&&self.Worker){var c=new Worker(t.filename);c.onmessage=function(e){l.highlightedCode=n.stringify(JSON.parse(e.data));l.element.innerHTML=l.highlightedCode;s&&s.call(l.element);t.hooks.run("after-highlight",l)};c.postMessage(JSON.stringify({language:l.language,code:l.code}))}else{l.highlightedCode=t.highlight(l.code,l.grammar);l.element.innerHTML=l.highlightedCode;s&&s.call(r);t.hooks.run("after-highlight",l)}},highlight:function(e,r){return n.stringify(t.tokenize(e,r))},tokenize:function(e,n){var r=t.Token,i=[e],s=n.rest;if(s){for(var o in s)n[o]=s[o];delete n.rest}e:for(var o in n){if(!n.hasOwnProperty(o)||!n[o])continue;var u=n[o],a=u.inside,f=!!u.lookbehind||0;u=u.pattern||u;for(var l=0;l<i.length;l++){var c=i[l];if(i.length>e.length)break e;if(c instanceof r)continue;u.lastIndex=0;var h=u.exec(c);if(h){f&&(f=h[1].length);var p=h.index-1+f,h=h[0].slice(f),d=h.length,v=p+d,m=c.slice(0,p+1),g=c.slice(v+1),y=[l,1];m&&y.push(m);var b=new r(o,a?t.tokenize(h,a):h);y.push(b);g&&y.push(g);Array.prototype.splice.apply(i,y)}}}return i},hooks:{all:{},add:function(e,n){var r=t.hooks.all;r[e]=r[e]||[];r[e].push(n)},run:function(e,n){var r=t.hooks.all[e];if(!r||!r.length)return;for(var i=0,s;s=r[i++];)s(n)}}},n=t.Token=function(e,t){this.type=e;this.content=t};n.stringify=function(e){if(typeof e=="string")return e;if(Object.prototype.toString.call(e)=="[object Array]"){for(var r=0;r<e.length;r++)e[r]=n.stringify(e[r]);return e.join("")}var i={type:e.type,content:n.stringify(e.content),tag:"span",classes:["token",e.type],attributes:{}};i.type=="comment"&&(i.attributes.spellcheck="true");t.hooks.run("wrap",i);var s="";for(var o in i.attributes)s+=o+'="'+(i.attributes[o]||"")+'"';return"<"+i.tag+' class="'+i.classes.join(" ")+'" '+s+">"+i.content+"</"+i.tag+">"};if(!self.document){self.addEventListener("message",function(e){var n=JSON.parse(e.data),r=n.language,i=n.code;self.postMessage(JSON.stringify(t.tokenize(i,t.languages[r])));self.close()},!1);return}var r=document.getElementsByTagName("script");r=r[r.length-1];if(r){t.filename=r.src;document.addEventListener&&!r.hasAttribute("data-manual")&&document.addEventListener("DOMContentLoaded",t.highlightAll)}})();;
Prism.languages.markup={comment:/&lt;!--[\w\W]*?--(&gt;|&gt;)/g,prolog:/&lt;\?.+?\?&gt;/,doctype:/&lt;!DOCTYPE.+?&gt;/,cdata:/&lt;!\[CDATA\[[\w\W]+?]]&gt;/i,tag:{pattern:/&lt;\/?[\w:-]+\s*(?:\s+[\w:-]+(?:=(?:("|')(\\?[\w\W])*?\1|\w+))?\s*)*\/?&gt;/gi,inside:{tag:{pattern:/^&lt;\/?[\w:-]+/i,inside:{punctuation:/^&lt;\/?/,namespace:/^[\w-]+?:/}},"attr-value":{pattern:/=(?:('|")[\w\W]*?(\1)|[^\s>]+)/gi,inside:{punctuation:/=|&gt;|"/g}},punctuation:/\/?&gt;/g,"attr-name":{pattern:/[\w:-]+/g,inside:{namespace:/^[\w-]+?:/}}}},entity:/&amp;#?[\da-z]{1,8};/gi};Prism.hooks.add("wrap",function(e){e.type==="entity"&&(e.attributes.title=e.content.replace(/&amp;/,"&"))});;
Prism.languages.css={comment:/\/\*[\w\W]*?\*\//g,atrule:/@[\w-]+?(\s+[^;{]+)?(?=\s*{|\s*;)/gi,url:/url\((["']?).*?\1\)/gi,selector:/[^\{\}\s][^\{\}]*(?=\s*\{)/g,property:/(\b|\B)[a-z-]+(?=\s*:)/ig,string:/("|')(\\?.)*?\1/g,important:/\B!important\b/gi,ignore:/&(lt|gt|amp);/gi,punctuation:/[\{\};:]/g};Prism.languages.markup&&Prism.languages.insertBefore("markup","tag",{style:{pattern:/(&lt;|<)style[\w\W]*?(>|&gt;)[\w\W]*?(&lt;|<)\/style(>|&gt;)/ig,inside:{tag:{pattern:/(&lt;|<)style[\w\W]*?(>|&gt;)|(&lt;|<)\/style(>|&gt;)/ig,inside:Prism.languages.markup.tag.inside},rest:Prism.languages.css}}});;
Prism.languages.clike={comment:{pattern:/(^|[^\\])(\/\*[\w\W]*?\*\/|\/\/.*?(\r?\n|$))/g,lookbehind:!0},string:/("|')(\\?.)*?\1/g,keyword:/\b(if|else|while|do|for|return|in|instanceof|function|new|try|catch|finally|null|break|continue)\b/g,"boolean":/\b(true|false)\b/g,number:/\b-?(0x)?\d*\.?[\da-f]+\b/g,operator:/[-+]{1,2}|!|=?&lt;|=?&gt;|={1,2}|(&amp;){1,2}|\|?\||\?|\*|\//g,ignore:/&(lt|gt|amp);/gi,punctuation:/[{}[\];(),.:]/g};;
Prism.languages.javascript=Prism.languages.extend("clike",{keyword:/\b(var|let|if|else|while|do|for|return|in|instanceof|function|new|with|typeof|try|catch|finally|null|break|continue)\b/g,number:/\b(-?(0x)?\d*\.?[\da-f]+|NaN|-?Infinity)\b/g});Prism.languages.insertBefore("javascript","keyword",{regex:{pattern:/(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\r\n])+\/[gim]{0,3}(?=\s*($|[\r\n,.;})]))/g,lookbehind:!0}});Prism.languages.markup&&Prism.languages.insertBefore("markup","tag",{script:{pattern:/(&lt;|<)script[\w\W]*?(>|&gt;)[\w\W]*?(&lt;|<)\/script(>|&gt;)/ig,inside:{tag:{pattern:/(&lt;|<)script[\w\W]*?(>|&gt;)|(&lt;|<)\/script(>|&gt;)/ig,inside:Prism.languages.markup.tag.inside},rest:Prism.languages.javascript}}});;

xtag.register('x-code-prism', {
  lifecycle:{
    created: function(){
      if (this.innerHTML.match(/&lt;/)){
        this.codeContent = this.innerHTML;
      } else {
        this.codeContent = this.textContent;
      }
    }
  },
  accessors:{
    'codeContent': {
      set: function(code){

        this.innerHTML = '<pre><code class="language-'+ 
          (this.getAttribute('language') || 'javascript') +'">' + 
            code + '</code></pre>';
        
        Prism.highlightElement(this.firstChild.firstChild, false);
      }
    }
  }
});
(function(){  

  xtag.register('x-panel', {
    mixins: ['request'],
    lifecycle:{
      created: function(){
        this.dataready = function(request){
            
          var frag = document.createDocumentFragment();
          var container = document.createElement('div');
          frag.appendChild(container);
          container.innerHTML = request.responseText;

          this.innerHTML = '';

          xtag.toArray(container.children).forEach(function(child){        
            if (child.nodeName == 'SCRIPT'){
              var script = document.createElement('script');
              script.type = child.type;
              if (child.src.length>0){
                script.src = child.src;
              }else{
                script.appendChild( 
                document.createTextNode(child.text||child.textContent||child.innerHTML));
              }
              this.appendChild(script);
            }
            else{                
              this.appendChild(child);
            }
          }, this);

      }
    }
  }
  });

})();