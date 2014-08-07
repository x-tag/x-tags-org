(function() {
    function addMenuArrow(node) {
        if (node.nodeName == "MENU" && node.parentNode.nodeName != "X-SLIDEMENU") {
            node.__slidemenuParent__ = node.parentNode;
            node.parentNode.setAttribute("x-slidemenu-node", "");
        }
    }
    function removeMenuArrow(node) {
        if (node.nodeName == "MENU") {
            node.__slidemenuParent__.removeAttribute("x-slidemenu-node");
            delete node.__slidemenuParent__;
        }
    }
    function menuState(action, menu) {
        action = action + "Attribute";
        menu[action]("active", "");
        menu[action]("selected", "");
    }
    xtag.register("x-slidemenu", {
        lifecycle: {
            created: function() {
                xtag.addObserver(this, "inserted", addMenuArrow);
                xtag.addObserver(this, "removed", removeMenuArrow);
                xtag.query(this, "menu").forEach(addMenuArrow);
            }
        },
        events: {
            "tap:delegate(menu > *)": function(e) {
                var menu = xtag.queryChildren(this, "menu")[0];
                if (menu) {
                    var active = e.currentTarget.querySelector("[active]");
                    if (active) active.removeAttribute("active");
                    menuState("set", menu);
                }
            },
            "tap:delegate(menu[selected])": function(e) {
                if (this.firstElementChild && e.pageY < this.firstElementChild.offsetTop) {
                    menuState("remove", this);
                    var active, parent = this.parentNode;
                    while (!active && parent != e.currentTarget) {
                        if (parent.nodeName == "MENU") menuState("set", active = parent);
                        parent = parent.parentNode;
                    }
                }
            }
        },
        accessors: {
            currentMenu: {
                get: function() {
                    return this.querySelector("menu[active]") || xtag.queryChildren(this, "menu")[0];
                }
            }
        },
        methods: {
            back: function() {
                var active = this.currentMenu;
                if (active) {
                    menuState("remove", active);
                    var next = active.parentNode;
                    while (next != this) {
                        if (next.nodeName == "MENU" && next.hasAttribute("selected")) {
                            next.setAttribute("active", "");
                            break;
                        }
                        next = next.parentNode;
                    }
                }
            },
            open: function(selector) {
                var menu = selector.nodeName ? selector : this.querySelector(selector);
                if (menu && menu.nodeName == "MENU") {
                    xtag.query(this, "menu[selected]").forEach(function(node) {
                        if (!node.contains(menu)) menuState("remove", node);
                    });
                    menuState("set", menu);
                    var parent = menu.parentNode;
                    while (parent) {
                        if (parent.nodeName == "MENU") parent.setAttribute("selected", "");
                        parent = parent != this && parent.parentNode;
                    }
                }
            }
        }
    });
})();