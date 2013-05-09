 window.onpopstate = function(e){
    if(e.state){
      slidePage(e.state.index,true);
    }
  }
  introImageLoads = 0;
  introAnimation = function(){
    introImageLoads++;
    if (introImageLoads == 2) {
      setTimeout(function(){
        document.getElementById('intro_graphic').className = 'animate-intro';
        setTimeout(function(){
          document.querySelector('#intro_logo div').className = 'switch-logo-x';
          document.getElementById('intro_graphic').className = 'animate-intro fade-intro';
        }, 300);
      }, 1000);
    }
  }

  slidePage = function(index,pop){
    var slide = document.querySelectorAll('#content_slidebox x-slide')[index];
    var url = "/" + slide.getAttribute('name');
    if (slide.firstElementChild.children.length == 0){
      slide.firstElementChild.src = url + "?frag";
    }
    if(!pop && location.pathname != url){
      history.pushState({
        page:slide.getAttribute('name'),
        index:index }, slide.getAttribute('name'), slide.getAttribute('name'));
    }
    document.querySelector('#global_nav x-slidebox').slideTo(index);
    document.getElementById('content_slidebox').slideTo(index);
  }

  xtag.addEvents(document, {
    'tap:delegate(#global_nav x-slide)': function(e){
      var index = Array.prototype.indexOf.call(this.parentNode.children, this);
      if (index == 4){ // registry
        window.open("http://registry.x-tags.org/");
      }
      else {
        slidePage(index);
      }
    },
    'tap:delegate(#registry_elements)': function(){
      window.open("http://registry.x-tags.org/");
    },
    'tap:delegate(#search_btn)': function(){
      var elem = document.getElementById('search_result_json_p');
      if (!elem){
        elem = document.createElement('script');
        document.body.appendChild(elem);
      }
      category = [];
      var query = document.getElementById('search_query').value.replace(/#(\w+)/g, function(match,group1,idx){
        category.push(group1);
        return '';
      });
      elem.src = "http://registry.x-tags.org/search?callback=search_results&query=" +
        query + "&category=" + category.join(',');
    },
    'keydown:keypass(13):delegate(#search_query)': function(e){
      console.log("keydown", e);
      xtag.fireEvent(document.getElementById('search_btn'), 'click');
    }
  });

  window.search_results = function(results){
    var container = document.getElementById('search_results');
    container.innerHTML = "";
    results.data.forEach(function(row){
      var item = document.createElement('x-search-result');
      item.templateData = row;
      container.appendChild(item);
    });
  }