
(function(){
  
  function createScript(element, type){
    var script = document.createElement('script');
    script.type = 'template/' + type;
    element.appendChild(script);
    return script;
  };
  
  function getPath(object, path){
    if (typeof path == 'string') path = path.split('.');
    var len = path.length, i = 0;
    while (len--){
      object = (object || {})[path[i++]];
      if (!len) return object;  
    }
  };
  
  function substitute(str, object, regexp) {    
    return String(str).replace(regexp || (/\\?\{([^{}]+)\}|%7B([^%7B,%7D]+)\%7D/g), function(match, name1, name2) {
      var name = name1 || name2;
      if (match.charAt(0) == '\\') return match.slice(1);
      if (object[name] != undefined) return object[name];
      var value = getPath(object, name);
      return (value == null || value == undefined) ? '' : value;
    });
  };
  
  function renderTemplate(element, html, data){
    return substitute(html, data||{});
  };
  
  xtag.pseudos.templateTarget = {
    listener: function(pseudo, fn, args){
      args[0].templateTarget = this;
      fn.apply(this, args);
    }
  };
  
  xtag.mixins.template = {      
    accessors:{
      'template': {
        get: function(){
          return this.getAttribute('template');
        },
        'set:attribute(template)':function(value){          
          var attr = this.getAttribute('template');
          if (value){
            this.xtag.__previousTemplate__ = attr;
            xtag.fireEvent(document, 'templatechange', { template: value, templateTarget: this });
          }
        }
      }
    }
  };
  
  document.addEventListener('templatechange', function(event){
    var template = xtag.query(document, 'x-template[name="' + event.template + '"]')[0];
    if (template) xtag.fireEvent(template, 'templatechange', { templateTarget: event.templateTarget }, { bubbles: false });
  }, false);
  
  xtag.register('x-template', {
    lifecycle:{
      created: function(){
        this.xtag.templateListeners = {};
        this.script = this.script;        
      }
    },
    accessors:{
      renderer:{
        get: function(){
          return this.xtag.renderer || renderTemplate;
        },
        set: function(fn){
          this.xtag.renderer = fn;
        }
      },
      beforeRender:{
        get: function(){
          return this.xtag.beforeRender;
        },
        set: function(fn){
          this.xtag.beforeRender = fn;
        }
      },
      name:{
        get: function(){
          return this.getAttribute('name');
        },
        set: function(name){
          this.setAttribute('name', name);
          this.render();
        }
      },
      script:{
        get: function(){
          return this.scriptElement.textContent;
        },
        set: function(script){
          this._dumpTemplateEvents();
          this.scriptElement.textContent = String(script);
          this.xtag.templateScript = (typeof script == 'function' ? script : new Function(script)).bind(this);
          this.xtag.templateScript();
        }
      },
      content:{
        get: function(){
          return this.contentElement.innerHTML;
        },
        set: function(content){
          this.contentElement.innerHTML = content;
          this.render();
        }
      },
      scriptElement:{
        get: function(){
          return this.querySelector('script[type="template/script"]') || createScript(this, 'script');
        }
      },
      contentElement:{
        get: function(){
          return this.querySelector('script[type="template/content"]') || createScript(this, 'content');
        }
      },
    },
    methods: {
      attachTemplate: function(element){
        var attached = this.xtag.attached = (this.xtag.attached || []);
        if (attached.indexOf(element) == -1) attached.push(element);
        this.render(element);
      },      
      detachTemplate: function(element){
        var attached = this.xtag.attached = (this.xtag.attached || []),
          index = attached.indexOf(element);
        if (index != -1) attached.splice(index, 1);
      },      
      render: function(elements){       
        var name = this.name;
        if (name) {
          var content = this.content;
          xtag.toArray(elements ? (elements.xtag ? [elements] : elements) : document.querySelectorAll('[template="' + name + '"]')).forEach(function(element){
            if (element.xtag) {
              for (var setter in this.xtag.templateSetters){
                var fn = this.xtag.templateSetters[setter],
                  prop = Object.getOwnPropertyDescriptor(element,setter);
                if (prop && prop.set){
                  var templateSetter = fn;
                  var oldSetter = prop.set;
                  fn = function(value){
                    oldSetter.call(element, value);
                    templateSetter.call(element, value);
                  }
                }
                xtag.applyAccessor(element, setter, "set", fn);
              }
              element.innerHTML = this.renderer.call(this, element, content, element.templateData);
            }
          }, this);
        }
      },      
      addTemplateListener: function(type, fn){
        var split = type.split(':');
          split.splice(1, 0, 'delegate([template="'+ this.name +'"]):templateTarget');
        var type = split.join(':');
        this.xtag.templateListeners[type] = this.xtag.templateListeners[type] || [];
        this.xtag.templateListeners[type].push(xtag.addEvent(document, type, fn));
      },      
      addTemplateListeners: function(events){
         for (var z in events) this.addTemplateListener(z, events[z]);
      },
      addTemplateSetters: function(setters){
        this.xtag.templateSetters = setters;
      },
      removeTemplateListener: function(type, fn){
        xtag.removeEvent(document, type, fn);
      },      
      _dumpTemplateEvents: function(){
        for (var z in this.xtag.templateListeners) this.xtag.templateListeners[z].forEach(function(fn){
          xtag.removeEvent(document, z, fn);
        });
      },
      
    },
    events: {
      'templatechange': function(event){
        var previous = xtag.query(document, 'x-template[name="' + event.templateTarget.xtag.__previousTemplate__ + '"]')[0];
        if (previous) previous.detachTemplate(event.templateTarget);
        this.attachTemplate(event.templateTarget);
      }
    }
  });
  
})();