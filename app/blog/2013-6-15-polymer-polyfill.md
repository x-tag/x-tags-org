# X-Tag & Polymer Now Share Web Component Polyfills


Several months ago X-Tag went through a massive rewrite in order to separate the X-Tag library from the W3 Custom Elements polyfill layer it relied upon. Decoupling X-Tag from the polyfill allowed us to make the polyfill layer swappable and reduce the library's footprint.

X-Tag and Polymer are both high-level sugar libraries that build upon the W3 Web Components specs - each introduces a different approach to making development of web components an even more amazing experience. To help make this more relatable, consider the following: jQuery : DOM :: X-Tag/Polymer : Web Components.

A few weeks ago, we began working with Google on a shared set of polyfills, which includes: Custom Elements, HTML Imports, HTML Templates, and Shadow DOM. In the spirit of open source, X-Tag has chosen to deprecate our own Custom Elements polyfill and contribute to a shared set of polyfills located within the [Polymer repository](https://github.com/Polymer). This is great for the web and great for X-Tag.  Mozilla and Google are now working to make this shared set of polyfills as adherent to the emerging W3 Web Component specs as possible -  which lets us spend more of our time making X-Tag the best tool for developing Web Components.

*Which polyfills are included in X-Tag?*

We selected to use HTMLImports, Custom Elements, and HTMLTemplate polyfills because we feel they provide you the most benefit without the bloat.  You can use the other polyfills from Polymer if you want to and everything will function as normal.

*What about Shadow DOM polyfill?*

While Shadow DOM sounds uber cool with its ability to hide elements inside shadow nodes, it is not necessary when creating custom elements.  It is a nice to have.  There are also performance implications to fake shadow DOM behavior in a polyfill.  We felt that it is best to leave this out and wait until we have native implementations in the browsers.

*What about MDV?*

We are experimenting with an alternative way to bind and relay data changes between templates and custom elements, more to come on that later.


##New Features

HTML Imports allows you to declare fragments of html - via `<template>` elements, custom element definitions - via `<element>` elements, and other dependent resources you would like, such as script, styles, and other HTML Imports - via `<link rel="import">`.

```html
<x-code-prism language="javascript">
 &lt;link rel="import" href="custom-elements.html" /&gt;
</x-code-prism>
```

The declaritive `<element>` tag (HTMLElementElement) is a another way to create custom elements. Notice the main difference is that you pass `this` to `xtag.register` instead of the element name and use the attributes to declare the name and constructor of the element.

```
<x-code-prism language="javascript">
&lt;element name=&quot;x-foo&quot; constructor=&quot;XFoo&quot;&gt;
  &lt;section&gt;
    I am x-foo
  &lt;/section&gt;
  &lt;script&gt;
  // polyfill runs this block twice,
  // once on initial parse and again in the scope of the element.
    if (this != window){
      var content = this.firstElementChild;
      xtag.register(this, {
        lifecycle: {
          created: function(){
            this.appendChild(content)
            console.log('created x-foo');
          }
        }
      });
    }
  &lt;/script&gt;
&lt;/element&gt;
</x-code-prism>
```

Templates are essentially a wrapper that automatically creates a document fragment out of its innerHTML, accessible via the `content` property. They are useful for declaring reusable blobs of HTML, something that is hackishly achieved today by using `<script>` elements with a non-JavaScript `type` property.

```
<x-code-prism language="javascript">
&lt;template&gt;
  &lt;span&gt;hello&lt;/span&gt;
&lt;/template&gt;
</x-code-prism>
```

