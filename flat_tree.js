"use strict";

var async = require('async');
var fs = require("fs");
var path = require("path");
var _ = require('underscore');
var assert = require('assert');

// get all package.json as individual nodes in an array
//	name, version, dependencies
//	only when root has package.json and follow subdirectory node_modules
// build a tree of dependent -> dependencies
// move leafs of tree to top-level (depth 0), replacing dependencies by symlinks

//modules = findAllModules('/usr/lib/node_modules')

// for(module in modules.keys()) {
// 	for(dependency in module.dependencies) {
// 		module.dependencies_link = modules[dependency.name];
// 	}	
// }

var dir = '/usr/lib/node_modules';
var generate_candidates = function(dir, candidate_dir) {
	return path.join(dir, path.join(candidate_dir, 'package.json'));
};

var read_package = function(file) {
	try {
		var parsed = JSON.parse(fs.readFileSync(file));
		console.log("read " + file);
		parsed.location = file;
		return parsed;
	} catch(e) {
		if(e.code == 'ENOENT')
			return null;	
		throw "Uncaught error: " + e;
	}
	
};

var prepostfix = function(dir, filename, subdir) { 
	return path.join(dir, path.join(subdir, filename)); 
};

var postfix = function(value, dir) {
	var dir = path.dirname(dir);
	return path.join(dir, value); 	
};

var load_packages = function(store_package, dir) {
	try {
		_.chain(fs.readdirSync(dir))
				.map(prepostfix.bind(this, dir, 'package.json'))
				.map(read_package)
				.filter(function(v) {return v;})
				.map(store_package)
				.pluck('location')
				.map(postfix.bind(this, 'node_modules'))
				.map(load_packages.bind(this, store_package))
				.filter(function(v) {return v;});
	} catch(e) {
		if(e.code == 'ENOENT')
			return null;	
		throw "Uncaught error: " + e;
	}
}

var packages = [];
var name_version_info = {};
var store_package = function(package_information) {
	packages.push(package_information);
	if(name_version_info[package_information.name] === undefined) {
		name_version_info[package_information.name] = {};		
	}
	if(name_version_info[package_information.name][package_information.version] === undefined) {
		name_version_info[package_information.name][package_information.version] = [];		
	}
	name_version_info[package_information.name][package_information.version].push(package_information);
	return package_information;
};

load_packages(store_package, dir);

console.log('finished!');