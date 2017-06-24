const fs = require('fs');
const os = require('os');
const path = require('path');
const spawn = require('child_process').spawn;

module.exports = function(config, dstDir, pkg, task, doneCallback) {
    console.log('[' + pkg.name + '] mvnPasswd');

    var inject = {
        "password": "XXXyyyZZZ"
    };

    const security = path.resolve(os.homedir(), 'teste', '.m2', 'settings-security.xml');

    securityRedirect();
    masterPassword();

    function securityRedirect() {
        const relocSecurity = config.mvnSecurity;
        console.log('[' + pkg.name + '] mvnPasswd - relocSecurity ' + relocSecurity);

        mkdirHierarchySync(path.dirname(relocSecurity));
        if (!fs.existsSync(relocSecurity)) {
            console.log('[' + pkg.name + '] mvnPasswd - create ' + relocSecurity);
            fs.writeFileSync(relocSecurity, `<settingsSecurity>
	<relocation>${security}</relocation>
</settingsSecurity>
`);
        }
    }

    function masterPassword() {
        const mavenHome = config.pkg['maven-3.5'].homeDir;
        console.log('[' + pkg.name + '] mvnPasswd - mavenHome ' + mavenHome);

        const maven = path.resolve(mavenHome, 'bin', 'mvn');
        console.log('[' + pkg.name + '] mvnPasswd - maven ' + maven);

        const mvn = spawn(maven, ['--encrypt-master-password', inject.password]);
        mvn.stdout.on('data', (data) => {
            const password = `${data}`.replace(os.EOL, '');
            mkdirHierarchySync(path.dirname(security));
            if (!fs.existsSync(security)) {
                console.log('[' + pkg.name + '] mvnPasswd - create ' + security);
                fs.writeFileSync(security, `<settingsSecurity>
	<master>${password}</master>
</settingsSecurity>
`);
            }

            doneCallback(null);
        });
    }

    function mkdirHierarchySync(pathname) {
        if (!pathname) {
            return;
        }

        if (fs.existsSync(pathname)) {
            return;
        }

        mkdirHierarchySync(path.dirname(pathname));

        console.log('[' + pkg.name + '] mvnPasswd - mkdir ' + pathname);
        fs.mkdirSync(pathname);
    }
}