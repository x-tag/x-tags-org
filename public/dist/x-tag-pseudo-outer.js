(function() {
    var events = {}, elements = {}, observers = {};
    function outerNodes(element, event) {
        var type = event.type, el = elements[type] || (elements[type] = []), ev = events[type] || (events[type] = []), i = el.indexOf(element);
        if (i == -1) {
            el.push(element);
            ev.push(event);
        } else {
            el.splice(i, 1);
            ev.splice(i, 1);
        }
        return el;
    }
    xtag.pseudos.outer = {
        action: function(pseudo, e) {
            if (this == e.target || this.contains && this.contains(e.target)) return null;
        },
        onRemove: function(pseudo) {
            if (!outerNodes(this, pseudo.source).length) {
                xtag.removeEvent(document, observers[pseudo.source.type]);
            }
        },
        onAdd: function(pseudo) {
            outerNodes(this, pseudo.source);
            var element = this, type = pseudo.source.type;
            if (!observers[type]) {
                observers[type] = xtag.addEvent(document, type, function(e) {
                    elements[type].forEach(function(node, i) {
                        if (node == e.target || node.contains(e.target)) return;
                        events[type][i].stack.call(node, e);
                    });
                });
            }
        }
    };
})();