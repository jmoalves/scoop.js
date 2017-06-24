module.exports = function(config, dstDir, pkg, task, doneCallback) {
    console.log('[' + pkg.name + ']\tEXEC ' + JSON.stringify(task));
    doneCallback(null);
}