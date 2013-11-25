# X-Tag - Custom Elements for Modern Browsers

X-Tag is a small JavaScript library, created and supported by Mozilla, that brings Web Components Custom Element capabilities to all modern browsers.

This is the repository for the [x-tag website](http://x-tags.org/).


## Setup

If you want to contribute to the website, simply follow these instructions.

First install [node.js](http://nodejs.org/) if it's not already in your system. Download and install it from their server, or use your favourite system package manager.

Clone our repository:

````bash
git clone git@github.com:x-tag/x-tags-org.git
````

Change to that directory and run:

````bash
npm install
````

Install bower (if you don't already have it)

````bash
npm install bower -g
````

Install components

````bash
bower install 
````

Combine js/css assets, see Gruntfile.js for details

````bash
grunt build
````

Run the site locally

````bash
node app
````

You can now access the site at [localhost:3000](http://localhost:3000).
