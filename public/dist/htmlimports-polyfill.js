window.HTMLImports = window.HTMLImports || {
    flags: {}
};

(function(scope) {
    var path = scope.path;
    var xhr = scope.xhr;
    var flags = scope.flags;
    var Loader = function(onLoad, onComplete) {
        this.cache = {};
        this.onload = onLoad;
        this.oncomplete = onComplete;
        this.inflight = 0;
        this.pending = {};
    };
    Loader.prototype = {
        addNodes: function(nodes) {
            this.inflight += nodes.length;
            for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
                this.require(n);
            }
            this.checkDone();
        },
        addNode: function(node) {
            this.inflight++;
            this.require(node);
            this.checkDone();
        },
        require: function(elt) {
            var url = elt.src || elt.href;
            elt.__nodeUrl = url;
            if (!this.dedupe(url, elt)) {
                this.fetch(url, elt);
            }
        },
        dedupe: function(url, elt) {
            if (this.pending[url]) {
                this.pending[url].push(elt);
                return true;
            }
            var resource;
            if (this.cache[url]) {
                this.onload(url, elt, this.cache[url]);
                this.tail();
                return true;
            }
            this.pending[url] = [ elt ];
            return false;
        },
        fetch: function(url, elt) {
            flags.load && console.log("fetch", url, elt);
            if (url.match(/^data:/)) {
                var pieces = url.split(",");
                var header = pieces[0];
                var body = pieces[1];
                if (header.indexOf(";base64") > -1) {
                    body = atob(body);
                } else {
                    body = decodeURIComponent(body);
                }
                setTimeout(function() {
                    this.receive(url, elt, null, body);
                }.bind(this), 0);
            } else {
                var receiveXhr = function(err, resource) {
                    this.receive(url, elt, err, resource);
                }.bind(this);
                xhr.load(url, receiveXhr);
            }
        },
        receive: function(url, elt, err, resource) {
            this.cache[url] = resource;
            var $p = this.pending[url];
            for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
                this.onload(url, p, resource);
                this.tail();
            }
            this.pending[url] = null;
        },
        tail: function() {
            --this.inflight;
            this.checkDone();
        },
        checkDone: function() {
            if (!this.inflight) {
                this.oncomplete();
            }
        }
    };
    xhr = xhr || {
        async: true,
        ok: function(request) {
            return request.status >= 200 && request.status < 300 || request.status === 304 || request.status === 0;
        },
        load: function(url, next, nextContext) {
            var request = new XMLHttpRequest();
            if (scope.flags.debug || scope.flags.bust) {
                url += "?" + Math.random();
            }
            request.open("GET", url, xhr.async);
            request.addEventListener("readystatechange", function(e) {
                if (request.readyState === 4) {
                    next.call(nextContext, !xhr.ok(request) && request, request.response || request.responseText, url);
                }
            });
            request.send();
            return request;
        },
        loadDocument: function(url, next, nextContext) {
            this.load(url, next, nextContext).responseType = "document";
        }
    };
    scope.xhr = xhr;
    scope.Loader = Loader;
})(window.HTMLImports);

(function(scope) {
    var IMPORT_LINK_TYPE = "import";
    var flags = scope.flags;
    var isIe = /Trident/.test(navigator.userAgent);
    var mainDoc = window.ShadowDOMPolyfill ? window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;
    var importParser = {
        documentSelectors: "link[rel=" + IMPORT_LINK_TYPE + "]",
        importsSelectors: [ "link[rel=" + IMPORT_LINK_TYPE + "]", "link[rel=stylesheet]", "style", "script:not([type])", 'script[type="text/javascript"]' ].join(","),
        map: {
            link: "parseLink",
            script: "parseScript",
            style: "parseStyle"
        },
        parseNext: function() {
            var next = this.nextToParse();
            if (next) {
                this.parse(next);
            }
        },
        parse: function(elt) {
            if (this.isParsed(elt)) {
                flags.parse && console.log("[%s] is already parsed", elt.localName);
                return;
            }
            var fn = this[this.map[elt.localName]];
            if (fn) {
                this.markParsing(elt);
                fn.call(this, elt);
            }
        },
        markParsing: function(elt) {
            flags.parse && console.log("parsing", elt);
            this.parsingElement = elt;
        },
        markParsingComplete: function(elt) {
            elt.__importParsed = true;
            if (elt.__importElement) {
                elt.__importElement.__importParsed = true;
            }
            this.parsingElement = null;
            flags.parse && console.log("completed", elt);
            this.parseNext();
        },
        parseImport: function(elt) {
            elt.import.__importParsed = true;
            if (HTMLImports.__importsParsingHook) {
                HTMLImports.__importsParsingHook(elt);
            }
            if (elt.__resource) {
                elt.dispatchEvent(new CustomEvent("load", {
                    bubbles: false
                }));
            } else {
                elt.dispatchEvent(new CustomEvent("error", {
                    bubbles: false
                }));
            }
            if (elt.__pending) {
                var fn;
                while (elt.__pending.length) {
                    fn = elt.__pending.shift();
                    if (fn) {
                        fn({
                            target: elt
                        });
                    }
                }
            }
            this.markParsingComplete(elt);
        },
        parseLink: function(linkElt) {
            if (nodeIsImport(linkElt)) {
                this.parseImport(linkElt);
            } else {
                linkElt.href = linkElt.href;
                this.parseGeneric(linkElt);
            }
        },
        parseStyle: function(elt) {
            var src = elt;
            elt = cloneStyle(elt);
            elt.__importElement = src;
            this.parseGeneric(elt);
        },
        parseGeneric: function(elt) {
            this.trackElement(elt);
            document.head.appendChild(elt);
        },
        trackElement: function(elt, callback) {
            var self = this;
            var done = function(e) {
                if (callback) {
                    callback(e);
                }
                self.markParsingComplete(elt);
            };
            elt.addEventListener("load", done);
            elt.addEventListener("error", done);
            if (isIe && elt.localName === "style") {
                var fakeLoad = false;
                if (elt.textContent.indexOf("@import") == -1) {
                    fakeLoad = true;
                } else if (elt.sheet) {
                    fakeLoad = true;
                    var csr = elt.sheet.cssRules;
                    var len = csr ? csr.length : 0;
                    for (var i = 0, r; i < len && (r = csr[i]); i++) {
                        if (r.type === CSSRule.IMPORT_RULE) {
                            fakeLoad = fakeLoad && Boolean(r.styleSheet);
                        }
                    }
                }
                if (fakeLoad) {
                    elt.dispatchEvent(new CustomEvent("load", {
                        bubbles: false
                    }));
                }
            }
        },
        parseScript: function(scriptElt) {
            var script = document.createElement("script");
            script.__importElement = scriptElt;
            script.src = scriptElt.src ? scriptElt.src : generateScriptDataUrl(scriptElt);
            scope.currentScript = scriptElt;
            this.trackElement(script, function(e) {
                script.parentNode.removeChild(script);
                scope.currentScript = null;
            });
            document.head.appendChild(script);
        },
        nextToParse: function() {
            return !this.parsingElement && this.nextToParseInDoc(mainDoc);
        },
        nextToParseInDoc: function(doc, link) {
            var nodes = doc.querySelectorAll(this.parseSelectorsForNode(doc));
            for (var i = 0, l = nodes.length, p = 0, n; i < l && (n = nodes[i]); i++) {
                if (!this.isParsed(n)) {
                    if (this.hasResource(n)) {
                        return nodeIsImport(n) ? this.nextToParseInDoc(n.import, n) : n;
                    } else {
                        return;
                    }
                }
            }
            return link;
        },
        parseSelectorsForNode: function(node) {
            var doc = node.ownerDocument || node;
            return doc === mainDoc ? this.documentSelectors : this.importsSelectors;
        },
        isParsed: function(node) {
            return node.__importParsed;
        },
        hasResource: function(node) {
            if (nodeIsImport(node) && !node.import) {
                return false;
            }
            return true;
        }
    };
    function nodeIsImport(elt) {
        return elt.localName === "link" && elt.rel === IMPORT_LINK_TYPE;
    }
    function generateScriptDataUrl(script) {
        var scriptContent = generateScriptContent(script), b64;
        try {
            b64 = btoa(scriptContent);
        } catch (e) {
            b64 = btoa(unescape(encodeURIComponent(scriptContent)));
            console.warn("Script contained non-latin characters that were forced " + "to latin. Some characters may be wrong.", script);
        }
        return "data:text/javascript;base64," + b64;
    }
    function generateScriptContent(script) {
        return script.textContent + generateSourceMapHint(script);
    }
    function generateSourceMapHint(script) {
        var moniker = script.__nodeUrl;
        if (!moniker) {
            moniker = script.ownerDocument.baseURI;
            var tag = "[" + Math.floor((Math.random() + 1) * 1e3) + "]";
            var matches = script.textContent.match(/Polymer\(['"]([^'"]*)/);
            tag = matches && matches[1] || tag;
            moniker += "/" + tag + ".js";
        }
        return "\n//# sourceURL=" + moniker + "\n";
    }
    function cloneStyle(style) {
        var clone = style.ownerDocument.createElement("style");
        clone.textContent = style.textContent;
        path.resolveUrlsInStyle(clone);
        return clone;
    }
    var CSS_URL_REGEXP = /(url\()([^)]*)(\))/g;
    var CSS_IMPORT_REGEXP = /(@import[\s]+(?!url\())([^;]*)(;)/g;
    var path = {
        resolveUrlsInStyle: function(style) {
            var doc = style.ownerDocument;
            var resolver = doc.createElement("a");
            style.textContent = this.resolveUrlsInCssText(style.textContent, resolver);
            return style;
        },
        resolveUrlsInCssText: function(cssText, urlObj) {
            var r = this.replaceUrls(cssText, urlObj, CSS_URL_REGEXP);
            r = this.replaceUrls(r, urlObj, CSS_IMPORT_REGEXP);
            return r;
        },
        replaceUrls: function(text, urlObj, regexp) {
            return text.replace(regexp, function(m, pre, url, post) {
                var urlPath = url.replace(/["']/g, "");
                urlObj.href = urlPath;
                urlPath = urlObj.href;
                return pre + "'" + urlPath + "'" + post;
            });
        }
    };
    scope.parser = importParser;
    scope.path = path;
    scope.isIE = isIe;
})(HTMLImports);

(function(scope) {
    var hasNative = "import" in document.createElement("link");
    var useNative = hasNative;
    var flags = scope.flags;
    var IMPORT_LINK_TYPE = "import";
    var mainDoc = window.ShadowDOMPolyfill ? ShadowDOMPolyfill.wrapIfNeeded(document) : document;
    if (!useNative) {
        var xhr = scope.xhr;
        var Loader = scope.Loader;
        var parser = scope.parser;
        var importer = {
            documents: {},
            documentPreloadSelectors: "link[rel=" + IMPORT_LINK_TYPE + "]",
            importsPreloadSelectors: [ "link[rel=" + IMPORT_LINK_TYPE + "]" ].join(","),
            loadNode: function(node) {
                importLoader.addNode(node);
            },
            loadSubtree: function(parent) {
                var nodes = this.marshalNodes(parent);
                importLoader.addNodes(nodes);
            },
            marshalNodes: function(parent) {
                return parent.querySelectorAll(this.loadSelectorsForNode(parent));
            },
            loadSelectorsForNode: function(node) {
                var doc = node.ownerDocument || node;
                return doc === mainDoc ? this.documentPreloadSelectors : this.importsPreloadSelectors;
            },
            loaded: function(url, elt, resource) {
                flags.load && console.log("loaded", url, elt);
                elt.__resource = resource;
                if (isDocumentLink(elt)) {
                    var doc = this.documents[url];
                    if (!doc) {
                        doc = makeDocument(resource, url);
                        doc.__importLink = elt;
                        this.bootDocument(doc);
                        this.documents[url] = doc;
                    }
                    elt.import = doc;
                }
                parser.parseNext();
            },
            bootDocument: function(doc) {
                this.loadSubtree(doc);
                this.observe(doc);
                parser.parseNext();
            },
            loadedAll: function() {
                parser.parseNext();
            }
        };
        var importLoader = new Loader(importer.loaded.bind(importer), importer.loadedAll.bind(importer));
        function isDocumentLink(elt) {
            return isLinkRel(elt, IMPORT_LINK_TYPE);
        }
        function isLinkRel(elt, rel) {
            return elt.localName === "link" && elt.getAttribute("rel") === rel;
        }
        function isScript(elt) {
            return elt.localName === "script";
        }
        function makeDocument(resource, url) {
            var doc = resource;
            if (!(doc instanceof Document)) {
                doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
            }
            doc._URL = url;
            var base = doc.createElement("base");
            base.setAttribute("href", url);
            if (!doc.baseURI) {
                doc.baseURI = url;
            }
            var meta = doc.createElement("meta");
            meta.setAttribute("charset", "utf-8");
            doc.head.appendChild(meta);
            doc.head.appendChild(base);
            if (!(resource instanceof Document)) {
                doc.body.innerHTML = resource;
            }
            if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
                HTMLTemplateElement.bootstrap(doc);
            }
            return doc;
        }
    } else {
        var importer = {};
    }
    var currentScriptDescriptor = {
        get: function() {
            return HTMLImports.currentScript || document.currentScript;
        },
        configurable: true
    };
    Object.defineProperty(document, "_currentScript", currentScriptDescriptor);
    Object.defineProperty(mainDoc, "_currentScript", currentScriptDescriptor);
    if (!document.baseURI) {
        var baseURIDescriptor = {
            get: function() {
                return window.location.href;
            },
            configurable: true
        };
        Object.defineProperty(document, "baseURI", baseURIDescriptor);
        Object.defineProperty(mainDoc, "baseURI", baseURIDescriptor);
    }
    function whenImportsReady(callback, doc) {
        doc = doc || mainDoc;
        whenDocumentReady(function() {
            watchImportsLoad(callback, doc);
        }, doc);
    }
    var requiredReadyState = HTMLImports.isIE ? "complete" : "interactive";
    var READY_EVENT = "readystatechange";
    function isDocumentReady(doc) {
        return doc.readyState === "complete" || doc.readyState === requiredReadyState;
    }
    function whenDocumentReady(callback, doc) {
        if (!isDocumentReady(doc)) {
            var checkReady = function() {
                if (doc.readyState === "complete" || doc.readyState === requiredReadyState) {
                    doc.removeEventListener(READY_EVENT, checkReady);
                    whenDocumentReady(callback, doc);
                }
            };
            doc.addEventListener(READY_EVENT, checkReady);
        } else if (callback) {
            callback();
        }
    }
    function watchImportsLoad(callback, doc) {
        var imports = doc.querySelectorAll("link[rel=import]");
        var loaded = 0, l = imports.length;
        function checkDone(d) {
            if (loaded == l) {
                requestAnimationFrame(callback);
            }
        }
        function loadedImport(e) {
            loaded++;
            checkDone();
        }
        if (l) {
            for (var i = 0, imp; i < l && (imp = imports[i]); i++) {
                if (isImportLoaded(imp)) {
                    loadedImport.call(imp);
                } else {
                    imp.addEventListener("load", loadedImport);
                    imp.addEventListener("error", loadedImport);
                }
            }
        } else {
            checkDone();
        }
    }
    function isImportLoaded(link) {
        return useNative ? link.import && link.import.readyState !== "loading" : link.__importParsed;
    }
    scope.hasNative = hasNative;
    scope.useNative = useNative;
    scope.importer = importer;
    scope.whenImportsReady = whenImportsReady;
    scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
    scope.isImportLoaded = isImportLoaded;
    scope.importLoader = importLoader;
})(window.HTMLImports);

(function(scope) {
    var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
    var importSelector = "link[rel=" + IMPORT_LINK_TYPE + "]";
    var importer = scope.importer;
    function handler(mutations) {
        for (var i = 0, l = mutations.length, m; i < l && (m = mutations[i]); i++) {
            if (m.type === "childList" && m.addedNodes.length) {
                addedNodes(m.addedNodes);
            }
        }
    }
    function addedNodes(nodes) {
        for (var i = 0, l = nodes.length, n; i < l && (n = nodes[i]); i++) {
            if (shouldLoadNode(n)) {
                importer.loadNode(n);
            }
            if (n.children && n.children.length) {
                addedNodes(n.children);
            }
        }
    }
    function shouldLoadNode(node) {
        return node.nodeType === 1 && matches.call(node, importer.loadSelectorsForNode(node));
    }
    var matches = HTMLElement.prototype.matches || HTMLElement.prototype.matchesSelector || HTMLElement.prototype.webkitMatchesSelector || HTMLElement.prototype.mozMatchesSelector || HTMLElement.prototype.msMatchesSelector;
    var observer = new MutationObserver(handler);
    function observe(root) {
        observer.observe(root, {
            childList: true,
            subtree: true
        });
    }
    scope.observe = observe;
    importer.observe = observe;
})(HTMLImports);

(function() {
    if (typeof window.CustomEvent !== "function") {
        window.CustomEvent = function(inType, dictionary) {
            var e = document.createEvent("HTMLEvents");
            e.initEvent(inType, dictionary.bubbles === false ? false : true, dictionary.cancelable === false ? false : true, dictionary.detail);
            return e;
        };
    }
    var doc = window.ShadowDOMPolyfill ? window.ShadowDOMPolyfill.wrapIfNeeded(document) : document;
    HTMLImports.whenImportsReady(function() {
        HTMLImports.ready = true;
        HTMLImports.readyTime = new Date().getTime();
        doc.dispatchEvent(new CustomEvent("HTMLImportsLoaded", {
            bubbles: true
        }));
    });
    if (!HTMLImports.useNative) {
        function bootstrap() {
            HTMLImports.importer.bootDocument(doc);
        }
        if (document.readyState === "complete" || document.readyState === "interactive" && !window.attachEvent) {
            bootstrap();
        } else {
            document.addEventListener("DOMContentLoaded", bootstrap);
        }
    }
})();