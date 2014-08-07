if (typeof WeakMap === "undefined") {
    (function() {
        var defineProperty = Object.defineProperty;
        var counter = Date.now() % 1e9;
        var WeakMap = function() {
            this.name = "__st" + (Math.random() * 1e9 >>> 0) + (counter++ + "__");
        };
        WeakMap.prototype = {
            set: function(key, value) {
                var entry = key[this.name];
                if (entry && entry[0] === key) entry[1] = value; else defineProperty(key, this.name, {
                    value: [ key, value ],
                    writable: true
                });
            },
            get: function(key) {
                var entry;
                return (entry = key[this.name]) && entry[0] === key ? entry[1] : undefined;
            },
            "delete": function(key) {
                this.set(key, undefined);
            }
        };
        window.WeakMap = WeakMap;
    })();
}