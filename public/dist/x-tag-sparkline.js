(function() {
    function max(arr) {
        var max = -999999;
        arr.forEach(function(v) {
            if (v > max) {
                max = v;
            }
        });
        return max;
    }
    function min(arr) {
        var min = 999999;
        arr.forEach(function(v) {
            if (v < min) {
                min = v;
            }
        });
        return min;
    }
    function draw(elem, data) {
        var len = data.length;
        w = elem.width, h = elem.height, _max = max(data), _min = min(data), sx = w / len, 
        x = 0, canvas = elem.xtag.canvas, ctx = elem.xtag.ctx;
        canvas.width = w;
        ctx.beginPath();
        for (var i = 0; i < len; ++i) {
            var n = data[i] - _min;
            ctx.lineTo(x += sx, h - h * (n / (_max - _min)));
        }
        ctx.stroke();
    }
    XSparkLine = xtag.register("x-sparkline", {
        lifecycle: {
            created: function() {
                this.innerHTML = "<canvas></canvas>";
                this.xtag.canvas = this.firstElementChild;
                this.xtag.ctx = this.xtag.canvas.getContext("2d");
                this.height = this.height;
                this.width = this.width;
                this.points = this.points;
            }
        },
        accessors: {
            points: {
                attribute: {},
                get: function() {
                    return this.xtag.points || this.getAttribute("points").replace(/[\[\]]/g, "").split(",").map(function(d) {
                        return Number(d);
                    }) || [];
                },
                set: function(value) {
                    var data = this.xtag.points = value.split ? value.split(",").map(function(d) {
                        return Number(d);
                    }) : value;
                    draw(this, this.points);
                }
            },
            height: {
                attribute: {},
                get: function() {
                    return this.getAttribute("height") || 12;
                },
                set: function(value) {
                    this.xtag.canvas.setAttribute("height", value);
                    draw(this, this.points);
                }
            },
            width: {
                attribute: {},
                get: function() {
                    return this.getAttribute("width") || 36;
                },
                set: function(value) {
                    this.xtag.canvas.setAttribute("width", value);
                    draw(this, this.points);
                }
            }
        }
    });
})();