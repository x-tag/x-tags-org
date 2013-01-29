
(function(){
  
  var flowEvent = function(){
      var growbox = this.parentNode.parentNode;
      if (growbox.tagName == 'X-GROWBOX') growbox.matchDimensions();
    },
    createFlowElements = function(wrap){      
      ['overflow', 'underflow'].forEach(function(type){
        if (!wrap.xtag[type + 'Element']) {
          var element = document.createElement('div');
            element.className = 'x-grow-' + type;
            element.innerHTML = '<div></div>';
            xtag.addEvent(element, type, flowEvent);
          wrap.xtag[type + 'Element'] = element;
          wrap.appendChild(element);
        }
      });
    };
  
  xtag.register('x-growbox', {
    lifecycle:{
      created: function(){        
        var frag = xtag.createFragment('<x-grow-wrap><x-grow-content></x-grow-content></x-grow-wrap>');
        var dest = frag.firstChild.firstChild;
        while(dest && this.firstElementChild){        
          dest.appendChild(this.firstElementChild);
        }
        this.appendChild(frag);
      }
    },
    methods: {
      matchDimensions: function(){
        var wrap = this.firstElementChild;
        if (wrap.tagName != 'X-GROW-WRAP') return;        
        createFlowElements(wrap);
        this.style.height = wrap.scrollHeight + 'px';
        wrap.xtag.overflowElement.firstChild.style.height = wrap.scrollHeight - 1 + 'px';
        wrap.xtag.underflowElement.firstChild.style.height = wrap.scrollHeight + 1 + 'px';
      }
    },
    events:{
      'resize': function(e){
        
      },
      'overflow': function(){
        this.matchDimensions();
      },
      'underflow': function(){
        this.matchDimensions();
      }
    }
  });
  
  xtag.register('x-grow-wrap', {
    lifecycle:{
      created: function(){
        createFlowElements(this);
        if (this.parentNode.tagName == 'X-GROWBOX') this.parentNode.matchDimensions();  
      }
    }
  });
  
})();