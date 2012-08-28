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
		parsed = _.pick(parsed, ['name', 'dependencies', 'devDependencies', 'version']);
		console.log("read " + file);
		parsed.location = file;
		parsed.depth = file.split('/').length
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

var dirname_eq = function(a, b) {
	return path.dirname(a) === b;
}

var load_packages = function(store_package, dir) {
	try {
		_.chain(fs.readdirSync(dir))
				.map(prepostfix.bind(null, dir, 'package.json'))
				.map(read_package)
				.filter(_.identity)
				.map(store_package)
				.pluck('location')
				.map(postfix.bind(null, 'node_modules'))
				.map(load_packages.bind(this, store_package))
				.filter(_.identity);
	} catch(e) {
		if(e.code == 'ENOENT')
			return null;	
		throw "Uncaught error: " + e;
	}
}


var move_package = function(dir, pkg_info) {
	console.log('mv ' + path.dirname(pkg_info.location) + ' ' + dir + '-' + pkg_info.version);
};

// expecting: [{pkg_info},{pkg_info},{pkg_info}]
var move_packages = function(dir, non_root) {
	_.map(non_root, move_package.bind(null, dir));
};

var debug_object = function(object) {
	console.log(object);
	return object;
}
var packages = [];
var name_version_info = {};
var store_package = function(pkg_info) {
	packages.push(pkg_info);
	if(name_version_info[pkg_info.name] === undefined) {
		name_version_info[pkg_info.name] = {};		
	}
	if(name_version_info[pkg_info.name][pkg_info.version] === undefined) {
		name_version_info[pkg_info.name][pkg_info.version] = [];		
	}
	name_version_info[pkg_info.name][pkg_info.version].push(pkg_info);
	return pkg_info;
};

load_packages(store_package, dir);

var non_root = _.chain(packages)
	.reject(dirname_eq.bind(null, dir))
	.groupBy('depth')
	.sortBy(function(v) {1.0/v;})
	.map(move_packages.bind(null, dir));

console.log(non_root);
console.log('finished!');