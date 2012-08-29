"use strict";

var async = require('async');
var fs = require("fs");
var path = require("path");
var _ = require('underscore');
var assert = require('assert');
var semver = require('semver');

var dir = '/usr/lib/node_modules';
var generate_candidates = function(dir, candidate_dir) {
	return path.join(dir, path.join(candidate_dir, 'package.json'));
};

var read_package = function(file) {
	try {
		var parsed = JSON.parse(fs.readFileSync(file));
		parsed = _.pick(parsed, ['name', 'dependencies', 'devDependencies', 'version']);
		console.log("read " + file);
		parsed.location = path.dirname(file);
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
	return path.join(dir, value); 	
};

var dirname_eq = function(dir, pkg_info) {
	console.log('comparing ' + dir + ' to ' + pkg_info.location);
	return dir === path.dirname(pkg_info.location);
}

// recursive call with function accumulator
var load_packages = function(store_package, dir) {
	try {
		_.chain(fs.readdirSync(dir))
				.map(prepostfix.bind(null, dir, 'package.json'))
				.map(read_package)
				.compact()
				.map(store_package)
				.pluck('location')
				.map(postfix.bind(null, 'node_modules'))
				.map(load_packages.bind(this, store_package))
				.compact()
	} catch(e) {
		if(e.code == 'ENOENT')
			return null;	
		throw "Uncaught error: " + e;
	}
}

var move_package = function(dir, pkg_info) {
	var src = pkg_info.location;
	var dest = path.join(dir, pkg_info.name + '-' + pkg_info.version);
	console.log('mv ' + src + ' ' + dest);
	pkg_info.location = dest;
};

// expecting: [{pkg_info},{pkg_info},{pkg_info}]
var move_packages = function(dir, non_root) {
	_.map(non_root, move_package.bind(null, dir));
	return non_root;
};

var debug_object = function(object) {
	console.log(object);
	return object;
};

var packages = [];

// hash of names -> hash of versions -> matching package
var name_version_info = {};
var store_package = function(pkg_info) {
	packages.push(pkg_info);
	if(name_version_info[pkg_info.name] === undefined) {
		name_version_info[pkg_info.name] = {};		
	}
	if(name_version_info[pkg_info.name][pkg_info.version] !== undefined) {
		console.log('Existing package with same version for ' + pkg_info.name + ' ignoring');
	}
	name_version_info[pkg_info.name][pkg_info.version] = pkg_info;
	return pkg_info;
};

var semver_satisfies = function(spec, pkg_info) {
	console.log('checking if ' + spec + ' is satisfied by ' + pkg_info.version);
	return semver.satisfies(pkg_info.version, spec);
};

var find_dependency = function(dep_ver, dep_name) {
	//console.log('looking up ' + dep_name + ' version ' + dep_ver);
	var pkg_info_list = name_version_info[dep_name]; 
	return _.chain(pkg_info_list)
		.values()
		.filter(semver_satisfies.bind(null, dep_ver))
		.sortBy(semver.rcompare)
		.first()
		.value();
};

var link_dependency = function(dir, pkg_info) {
	console.log('symlinking for ' + dir + ' to ' + pkg_info.location);
	var node_modules_dir = path.join(dir, 'node_modules');
	var symlink = path.join(node_modules_dir, pkg_info.name);
	console.log('ln -s ' + pkg_info.location + ' ' + symlink);
};

var link_dependencies = function(pkg_info) {
	_.chain(pkg_info.dependencies)
		.map(find_dependency)
		.map(link_dependency.bind(null, pkg_info.location))
};

// recursive call
load_packages(store_package, dir);

_.chain(packages)
	.reject(dirname_eq.bind(null, dir))
	.groupBy('depth')
	.sortBy(function(v) {1.0/v;})
	.map(move_packages.bind(null, dir))
	.flatten(true)
	.map(link_dependencies);

console.log('finished!');