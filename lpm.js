"use strict";

var _ = require('underscore');
var assert = require('assert');
var async = require('async');
var fs = require("fs");
var path = require("path");
var program = require('commander');
var semver = require('semver');

var verbose = function(string) {
	if(program.verbose)
		console.log(string);
}

var warn = function(string) {
	console.log(string);
}

var generate_candidates = function(dir, candidate_dir) {
	return path.join(dir, path.join(candidate_dir, 'package.json'));
};

var read_package = function(file) {
	try {
		var parsed = JSON.parse(fs.readFileSync(file));
		parsed = _.pick(parsed, ['name', 'dependencies', 'devDependencies', 'version', 'bin']);
		verbose("read " + file);
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
	verbose('comparing ' + dir + ' to ' + pkg_info.location);
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
	} catch(e) {
		if(e.code == 'ENOENT')
			return null;	
		throw "Uncaught error while loading from " + dir + ": " + e;
	}
}

var move_package = function(dir, pkg_info) {
	var src = pkg_info.location;
	var dest = path.join(dir, pkg_info.name + '-' + pkg_info.version);
	verbose('mv ' + src + ' ' + dest);
	pkg_info.location = dest;
};

// expecting: [{pkg_info},{pkg_info},{pkg_info}]
var move_packages = function(dir, non_root) {
	_.map(non_root, move_package.bind(null, dir));
	return non_root;
};

var debug_object = function(object) {
	verbose(object);
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
		warn('Ignoring existing package with same version for ' + pkg_info.name + ' ' + pkg_info.location);
	}
	name_version_info[pkg_info.name][pkg_info.version] = pkg_info;
	return pkg_info;
};

var semver_satisfies = function(spec, pkg_info) {
	verbose('checking if ' + spec + ' is satisfied by ' + pkg_info.version);
	return semver.satisfies(pkg_info.version, spec);
};

var find_dependency = function(dep_ver, dep_name) {
	verbose('looking up ' + dep_name + ' version ' + dep_ver);
	var pkg_info_list = name_version_info[dep_name]; 
	return _.chain(pkg_info_list)
		.values()
		.filter(semver_satisfies.bind(null, dep_ver))
		.sortBy(semver.rcompare)
		.first()
		.value();
};

var link_dependency = function(dir, pkg_info) {
	verbose('symlinking for ' + dir + ' to ' + pkg_info.location);
	var node_modules_dir = path.join(dir, 'node_modules');
	var symlink = path.join(node_modules_dir, pkg_info.name);
	verbose('ln -s ' + pkg_info.location + ' ' + symlink);
};

var link_dependencies = function(pkg_info) {
	_.chain(pkg_info.dependencies)
		.map(find_dependency)
		.map(link_dependency.bind(null, pkg_info.location))
};

var remove_extension = function(p) {
	return p.slice(0, p.lastIndexOf(path.extname(p)));
};

var link_bin = function(target, pkg_info, bin) {
	verbose('symlinking in ' + target + ' from '+ pkg_info.name + ' binary '+ bin)
	var source = path.join(pkg_info.location, bin);
	var symlink = remove_extension(path.join(target, path.basename(source)));
	if(path.exists(symlink)) {
		throw 'already exist: ' + symlink;
	} else {
		verbose('ln -s ' + source + ' ' + symlink);
	}
};

var link_bins = function(target, pkg_info) {
	if(pkg_info.bin instanceof Object) {
		_.chain(pkg_info.bin)
			.each(link_bin.bind(null, target, pkg_info));

	} else {
		link_bin(target, pkg_info, pkg_info.bin);
	}
};

var flatten = function() {
	console.log('flattening structure');
	console.log('modifying: ' + program.target_dir);
	console.log('moving to: ' + program.modules_dir);
	console.log('linking binaries: ' + program.bin_dir);
	load_packages(store_package, program.target_dir);

	_.chain(packages)
		.reject(dirname_eq.bind(null, program.modules_dir))
		.groupBy('depth')
		.sortBy(function(v) {1.0/v;})
		.map(move_packages.bind(null, program.modules_dir))
		.flatten(true)
		.map(link_dependencies);

	_.chain(packages) 
		.filter(function(v) { return v['bin']; })
		.map(link_bins.bind(null, program.bin_dir));

	console.log('processed ' + packages.length + ' packages');
};

program
	.version('0.0.1')
	.option('-m, --modules_dir [dir]', 'Node modules global directory', '/usr/lib/node_modules')
	.option('-t, --target_dir [dir]', 'Apply action to this directory tree', '/usr/lib/node_modules')
	.option('-b, --bin_dir [dir]', 'symlink binaries here', '/usr/bin')
	.option('-v, --verbose', 'verbose output')
	.command('flatten')
	.description('flatten a node_modules directory structure')
	.action(flatten);
program.parse(process.argv);