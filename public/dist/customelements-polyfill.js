if (!window.CustomElements) {
    window.CustomElements = {
        flags: {}
    };
}

(function(scope) {
    var logFlags = window.logFlags || {};
    var IMPORT_LINK_TYPE = window.HTMLImports ? HTMLImports.IMPORT_LINK_TYPE : "none";
    function findAll(node, find, data) {
        var e = node.firstElementChild;
        if (!e) {
            e = node.firstChild;
            while (e && e.nodeType !== Node.ELEMENT_NODE) {
                e = e.nextSibling;
            }
        }
        while (e) {
            if (find(e, data) !== true) {
                findAll(e, find, data);
            }
            e = e.nextElementSibling;
        }
        return null;
    }
    function forRoots(node, cb) {
        var root = node.shadowRoot;
        while (root) {
            forSubtree(root, cb);
            root = root.olderShadowRoot;
        }
    }
    function forSubtree(node, cb) {
        findAll(node, function(e) {
            if (cb(e)) {
                return true;
            }
            forRoots(e, cb);
        });
        forRoots(node, cb);
    }
    function added(node) {
        if (upgrade(node)) {
            insertedNode(node);
            return true;
        }
        inserted(node);
    }
    function addedSubtree(node) {
        forSubtree(node, function(e) {
            if (added(e)) {
                return true;
            }
        });
    }
    function addedNode(node) {
        return added(node) || addedSubtree(node);
    }
    function upgrade(node) {
        if (!node.__upgraded__ && node.nodeType === Node.ELEMENT_NODE) {
            var type = node.getAttribute("is") || node.localName;
            var definition = scope.registry[type];
            if (definition) {
                logFlags.dom && console.group("upgrade:", node.localName);
                scope.upgrade(node);
                logFlags.dom && console.groupEnd();
                return true;
            }
        }
    }
    function insertedNode(node) {
        inserted(node);
        if (inDocument(node)) {
            forSubtree(node, function(e) {
                inserted(e);
            });
        }
    }
    var hasPolyfillMutations = !window.MutationObserver || window.MutationObserver === window.JsMutationObserver;
    scope.hasPolyfillMutations = hasPolyfillMutations;
    var isPendingMutations = false;
    var pendingMutations = [];
    function deferMutation(fn) {
        pendingMutations.push(fn);
        if (!isPendingMutations) {
            isPendingMutations = true;
            var async = window.Platform && window.Platform.endOfMicrotask || setTimeout;
            async(takeMutations);
        }
    }
    function takeMutations() {
        isPendingMutations = false;
        var $p = pendingMutations;
        for (var i = 0, l = $p.length, p; i < l && (p = $p[i]); i++) {
            p();
        }
        pendingMutations = [];
    }
    function inserted(element) {
        if (hasPolyfillMutations) {
            deferMutation(function() {
                _inserted(element);
            });
        } else {
            _inserted(element);
        }
    }
    function _inserted(element) {
        if (element.attachedCallback || element.detachedCallback || element.__upgraded__ && logFlags.dom) {
            logFlags.dom && console.group("inserted:", element.localName);
            if (inDocument(element)) {
                element.__inserted = (element.__inserted || 0) + 1;
                if (element.__inserted < 1) {
                    element.__inserted = 1;
                }
                if (element.__inserted > 1) {
                    logFlags.dom && console.warn("inserted:", element.localName, "insert/remove count:", element.__inserted);
                } else if (element.attachedCallback) {
                    logFlags.dom && console.log("inserted:", element.localName);
                    element.attachedCallback();
                }
            }
            logFlags.dom && console.groupEnd();
        }
    }
    function removedNode(node) {
        removed(node);
        forSubtree(node, function(e) {
            removed(e);
        });
    }
    function removed(element) {
        if (hasPolyfillMutations) {
            deferMutation(function() {
                _removed(element);
            });
        } else {
            _removed(element);
        }
    }
    function _removed(element) {
        if (element.attachedCallback || element.detachedCallback || element.__upgraded__ && logFlags.dom) {
            logFlags.dom && console.group("removed:", element.localName);
            if (!inDocument(element)) {
                element.__inserted = (element.__inserted || 0) - 1;
                if (element.__inserted > 0) {
                    element.__inserted = 0;
                }
                if (element.__inserted < 0) {
                    logFlags.dom && console.warn("removed:", element.localName, "insert/remove count:", element.__inserted);
                } else if (element.detachedCallback) {
                    element.detachedCallback();
                }
            }
            logFlags.dom && console.groupEnd();
        }
    }
    function wrapIfNeeded(node) {
        return window.ShadowDOMPolyfill ? ShadowDOMPolyfill.wrapIfNeeded(node) : node;
    }
    function inDocument(element) {
        var p = element;
        var doc = wrapIfNeeded(document);
        while (p) {
            if (p == doc) {
                return true;
            }
            p = p.parentNode || p.host;
        }
    }
    function watchShadow(node) {
        if (node.shadowRoot && !node.shadowRoot.__watched) {
            logFlags.dom && console.log("watching shadow-root for: ", node.localName);
            var root = node.shadowRoot;
            while (root) {
                watchRoot(root);
                root = root.olderShadowRoot;
            }
        }
    }
    function watchRoot(root) {
        if (!root.__watched) {
            observe(root);
            root.__watched = true;
        }
    }
    function handler(mutations) {
        if (logFlags.dom) {
            var mx = mutations[0];
            if (mx && mx.type === "childList" && mx.addedNodes) {
                if (mx.addedNodes) {
                    var d = mx.addedNodes[0];
                    while (d && d !== document && !d.host) {
                        d = d.parentNode;
                    }
                    var u = d && (d.URL || d._URL || d.host && d.host.localName) || "";
                    u = u.split("/?").shift().split("/").pop();
                }
            }
            console.group("mutations (%d) [%s]", mutations.length, u || "");
        }
        mutations.forEach(function(mx) {
            if (mx.type === "childList") {
                forEach(mx.addedNodes, function(n) {
                    if (!n.localName) {
                        return;
                    }
                    addedNode(n);
                });
                forEach(mx.removedNodes, function(n) {
                    if (!n.localName) {
                        return;
                    }
                    removedNode(n);
                });
            }
        });
        logFlags.dom && console.groupEnd();
    }
    var observer = new MutationObserver(handler);
    function takeRecords() {
        handler(observer.takeRecords());
        takeMutations();
    }
    var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
    function observe(inRoot) {
        observer.observe(inRoot, {
            childList: true,
            subtree: true
        });
    }
    function observeDocument(doc) {
        observe(doc);
    }
    function upgradeDocument(doc) {
        logFlags.dom && console.group("upgradeDocument: ", doc.baseURI.split("/").pop());
        addedNode(doc);
        logFlags.dom && console.groupEnd();
    }
    function upgradeDocumentTree(doc) {
        doc = wrapIfNeeded(doc);
        var imports = doc.querySelectorAll("link[rel=" + IMPORT_LINK_TYPE + "]");
        for (var i = 0, l = imports.length, n; i < l && (n = imports[i]); i++) {
            if (n.import && n.import.__parsed) {
                upgradeDocumentTree(n.import);
            }
        }
        upgradeDocument(doc);
    }
    scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
    scope.watchShadow = watchShadow;
    scope.upgradeDocumentTree = upgradeDocumentTree;
    scope.upgradeAll = addedNode;
    scope.upgradeSubtree = addedSubtree;
    scope.insertedNode = insertedNode;
    scope.observeDocument = observeDocument;
    scope.upgradeDocument = upgradeDocument;
    scope.takeRecords = takeRecords;
})(window.CustomElements);

(function(scope) {
    if (!scope) {
        scope = window.CustomElements = {
            flags: {}
        };
    }
    var flags = scope.flags;
    var hasNative = Boolean(document.registerElement);
    var useNative = !flags.register && hasNative && !window.ShadowDOMPolyfill;
    if (useNative) {
        var nop = function() {};
        scope.registry = {};
        scope.upgradeElement = nop;
        scope.watchShadow = nop;
        scope.upgrade = nop;
        scope.upgradeAll = nop;
        scope.upgradeSubtree = nop;
        scope.observeDocument = nop;
        scope.upgradeDocument = nop;
        scope.upgradeDocumentTree = nop;
        scope.takeRecords = nop;
        scope.reservedTagList = [];
    } else {
        function register(name, options) {
            var definition = options || {};
            if (!name) {
                throw new Error("document.registerElement: first argument `name` must not be empty");
            }
            if (name.indexOf("-") < 0) {
                throw new Error("document.registerElement: first argument ('name') must contain a dash ('-'). Argument provided was '" + String(name) + "'.");
            }
            if (isReservedTag(name)) {
                throw new Error("Failed to execute 'registerElement' on 'Document': Registration failed for type '" + String(name) + "'. The type name is invalid.");
            }
            if (getRegisteredDefinition(name)) {
                throw new Error("DuplicateDefinitionError: a type with name '" + String(name) + "' is already registered");
            }
            if (!definition.prototype) {
                throw new Error("Options missing required prototype property");
            }
            definition.__name = name.toLowerCase();
            definition.lifecycle = definition.lifecycle || {};
            definition.ancestry = ancestry(definition.extends);
            resolveTagName(definition);
            resolvePrototypeChain(definition);
            overrideAttributeApi(definition.prototype);
            registerDefinition(definition.__name, definition);
            definition.ctor = generateConstructor(definition);
            definition.ctor.prototype = definition.prototype;
            definition.prototype.constructor = definition.ctor;
            if (scope.ready) {
                scope.upgradeDocumentTree(document);
            }
            return definition.ctor;
        }
        function isReservedTag(name) {
            for (var i = 0; i < reservedTagList.length; i++) {
                if (name === reservedTagList[i]) {
                    return true;
                }
            }
        }
        var reservedTagList = [ "annotation-xml", "color-profile", "font-face", "font-face-src", "font-face-uri", "font-face-format", "font-face-name", "missing-glyph" ];
        function ancestry(extnds) {
            var extendee = getRegisteredDefinition(extnds);
            if (extendee) {
                return ancestry(extendee.extends).concat([ extendee ]);
            }
            return [];
        }
        function resolveTagName(definition) {
            var baseTag = definition.extends;
            for (var i = 0, a; a = definition.ancestry[i]; i++) {
                baseTag = a.is && a.tag;
            }
            definition.tag = baseTag || definition.__name;
            if (baseTag) {
                definition.is = definition.__name;
            }
        }
        function resolvePrototypeChain(definition) {
            if (!Object.__proto__) {
                var nativePrototype = HTMLElement.prototype;
                if (definition.is) {
                    var inst = document.createElement(definition.tag);
                    nativePrototype = Object.getPrototypeOf(inst);
                }
                var proto = definition.prototype, ancestor;
                while (proto && proto !== nativePrototype) {
                    var ancestor = Object.getPrototypeOf(proto);
                    proto.__proto__ = ancestor;
                    proto = ancestor;
                }
            }
            definition.native = nativePrototype;
        }
        function instantiate(definition) {
            return upgrade(domCreateElement(definition.tag), definition);
        }
        function upgrade(element, definition) {
            if (definition.is) {
                element.setAttribute("is", definition.is);
            }
            element.removeAttribute("unresolved");
            implement(element, definition);
            element.__upgraded__ = true;
            created(element);
            scope.insertedNode(element);
            scope.upgradeSubtree(element);
            return element;
        }
        function implement(element, definition) {
            if (Object.__proto__) {
                element.__proto__ = definition.prototype;
            } else {
                customMixin(element, definition.prototype, definition.native);
                element.__proto__ = definition.prototype;
            }
        }
        function customMixin(inTarget, inSrc, inNative) {
            var used = {};
            var p = inSrc;
            while (p !== inNative && p !== HTMLElement.prototype) {
                var keys = Object.getOwnPropertyNames(p);
                for (var i = 0, k; k = keys[i]; i++) {
                    if (!used[k]) {
                        Object.defineProperty(inTarget, k, Object.getOwnPropertyDescriptor(p, k));
                        used[k] = 1;
                    }
                }
                p = Object.getPrototypeOf(p);
            }
        }
        function created(element) {
            if (element.createdCallback) {
                element.createdCallback();
            }
        }
        function overrideAttributeApi(prototype) {
            if (prototype.setAttribute._polyfilled) {
                return;
            }
            var setAttribute = prototype.setAttribute;
            prototype.setAttribute = function(name, value) {
                changeAttribute.call(this, name, value, setAttribute);
            };
            var removeAttribute = prototype.removeAttribute;
            prototype.removeAttribute = function(name) {
                changeAttribute.call(this, name, null, removeAttribute);
            };
            prototype.setAttribute._polyfilled = true;
        }
        function changeAttribute(name, value, operation) {
            var oldValue = this.getAttribute(name);
            operation.apply(this, arguments);
            var newValue = this.getAttribute(name);
            if (this.attributeChangedCallback && newValue !== oldValue) {
                this.attributeChangedCallback(name, oldValue, newValue);
            }
        }
        var registry = {};
        function getRegisteredDefinition(name) {
            if (name) {
                return registry[name.toLowerCase()];
            }
        }
        function registerDefinition(name, definition) {
            registry[name] = definition;
        }
        function generateConstructor(definition) {
            return function() {
                return instantiate(definition);
            };
        }
        var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
        function createElementNS(namespace, tag, typeExtension) {
            if (namespace === HTML_NAMESPACE) {
                return createElement(tag, typeExtension);
            } else {
                return domCreateElementNS(namespace, tag);
            }
        }
        function createElement(tag, typeExtension) {
            var definition = getRegisteredDefinition(typeExtension || tag);
            if (definition) {
                if (tag == definition.tag && typeExtension == definition.is) {
                    return new definition.ctor();
                }
                if (!typeExtension && !definition.is) {
                    return new definition.ctor();
                }
            }
            if (typeExtension) {
                var element = createElement(tag);
                element.setAttribute("is", typeExtension);
                return element;
            }
            var element = domCreateElement(tag);
            if (tag.indexOf("-") >= 0) {
                implement(element, HTMLElement);
            }
            return element;
        }
        function upgradeElement(element) {
            if (!element.__upgraded__ && element.nodeType === Node.ELEMENT_NODE) {
                var is = element.getAttribute("is");
                var definition = getRegisteredDefinition(is || element.localName);
                if (definition) {
                    if (is && definition.tag == element.localName) {
                        return upgrade(element, definition);
                    } else if (!is && !definition.extends) {
                        return upgrade(element, definition);
                    }
                }
            }
        }
        function cloneNode(deep) {
            var n = domCloneNode.call(this, deep);
            scope.upgradeAll(n);
            return n;
        }
        var domCreateElement = document.createElement.bind(document);
        var domCreateElementNS = document.createElementNS.bind(document);
        var domCloneNode = Node.prototype.cloneNode;
        document.registerElement = register;
        document.createElement = createElement;
        document.createElementNS = createElementNS;
        Node.prototype.cloneNode = cloneNode;
        scope.registry = registry;
        scope.upgrade = upgradeElement;
    }
    var isInstance;
    if (!Object.__proto__ && !useNative) {
        isInstance = function(obj, ctor) {
            var p = obj;
            while (p) {
                if (p === ctor.prototype) {
                    return true;
                }
                p = p.__proto__;
            }
            return false;
        };
    } else {
        isInstance = function(obj, base) {
            return obj instanceof base;
        };
    }
    scope.instanceof = isInstance;
    scope.reservedTagList = reservedTagList;
    document.register = document.registerElement;
    scope.hasNative = hasNative;
    scope.useNative = useNative;
})(window.CustomElements);

(function(scope) {
    var IMPORT_LINK_TYPE = scope.IMPORT_LINK_TYPE;
    var parser = {
        selectors: [ "link[rel=" + IMPORT_LINK_TYPE + "]" ],
        map: {
            link: "parseLink"
        },
        parse: function(inDocument) {
            if (!inDocument.__parsed) {
                inDocument.__parsed = true;
                var elts = inDocument.querySelectorAll(parser.selectors);
                forEach(elts, function(e) {
                    parser[parser.map[e.localName]](e);
                });
                CustomElements.upgradeDocument(inDocument);
                CustomElements.observeDocument(inDocument);
            }
        },
        parseLink: function(linkElt) {
            if (isDocumentLink(linkElt)) {
                this.parseImport(linkElt);
            }
        },
        parseImport: function(linkElt) {
            if (linkElt.import) {
                parser.parse(linkElt.import);
            }
        }
    };
    function isDocumentLink(inElt) {
        return inElt.localName === "link" && inElt.getAttribute("rel") === IMPORT_LINK_TYPE;
    }
    var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
    scope.parser = parser;
    scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;
})(window.CustomElements);

(function(scope) {
    function bootstrap() {
        CustomElements.parser.parse(document);
        CustomElements.upgradeDocument(document);
        var async = window.Platform && Platform.endOfMicrotask ? Platform.endOfMicrotask : setTimeout;
        async(function() {
            CustomElements.ready = true;
            CustomElements.readyTime = Date.now();
            if (window.HTMLImports) {
                CustomElements.elapsed = CustomElements.readyTime - HTMLImports.readyTime;
            }
            document.dispatchEvent(new CustomEvent("WebComponentsReady", {
                bubbles: true
            }));
            if (window.HTMLImports) {
                HTMLImports.__importsParsingHook = function(elt) {
                    CustomElements.parser.parse(elt.import);
                };
            }
        });
    }
    if (typeof window.CustomEvent !== "function") {
        window.CustomEvent = function(inType) {
            var e = document.createEvent("HTMLEvents");
            e.initEvent(inType, true, true);
            return e;
        };
    }
    if (document.readyState === "complete" || scope.flags.eager) {
        bootstrap();
    } else if (document.readyState === "interactive" && !window.attachEvent && (!window.HTMLImports || window.HTMLImports.ready)) {
        bootstrap();
    } else {
        var loadEvent = window.HTMLImports && !HTMLImports.ready ? "HTMLImportsLoaded" : "DOMContentLoaded";
        window.addEventListener(loadEvent, bootstrap);
    }
})(window.CustomElements);