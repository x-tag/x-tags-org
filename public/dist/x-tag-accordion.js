(function() {
    var hlevels = "h1, h2, h3, h4, h5, h6", select = function(heading) {
        xtag.query(heading.parentNode, hlevels).forEach(function(el, idx) {
            if (el == heading) {
                this.selectedIndex = idx;
                heading.focus();
            }
        }, this);
    };
    xtag.register("x-accordion", {
        lifecycle: {
            created: function() {
                var idx = Number(this.getAttribute("selected-index"));
                if (idx) {
                    this.setSelectedIndex(idx);
                } else {
                    var selected = xtag.queryChildren(this, "[selected]")[0];
                    if (selected) select(selected);
                }
            }
        },
        events: {
            "tap:delegate(h1, h2, h3, h4, h5, h6)": function(event) {
                select.call(event.target.parentNode, this);
            },
            "keydown:delegate(h1, h2, h3, h4, h5, h6)": function(event) {
                switch (event.keyCode) {
                  case 13:
                    select.call(event.target.parentNode, this);
                    break;

                  case 37:
                    event.target.parentNode.selectPrevious();
                    break;

                  case 39:
                    event.target.parentNode.selectNext();
                    break;
                }
            }
        },
        accessors: {
            selectedIndex: {
                attribute: {
                    name: "selected-index"
                },
                set: function(value) {
                    xtag.query(this, hlevels).forEach(function(el, idx) {
                        if (value == idx) {
                            el.setAttribute("selected", null);
                            xtag.fireEvent(el, "selected");
                        } else el.removeAttribute("selected");
                    }, this);
                },
                get: function() {
                    return Number(this.getAttribute("selected-index")) || xtag.queryChildren(this, hlevels).indexOf(xtag.queryChildren(this, "[selected]")[0]);
                }
            }
        },
        methods: {
            getSelected: function() {
                return xtag.queryChildren(this, "[selected]")[0];
            },
            setSelected: select,
            selectNext: function() {
                var headings = xtag.query(this, hlevels);
                if (headings[0]) select.call(this, headings[this.selectedIndex + 1] || headings[0]);
            },
            selectPrevious: function() {
                var headings = xtag.query(this, hlevels);
                if (headings[0]) select.call(this, headings[this.selectedIndex - 1] || headings.pop());
            }
        }
    });
})();