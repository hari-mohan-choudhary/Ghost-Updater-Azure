/*! Ghost-Updater-Azure - v0.6.1 - 2016-03-18 */var UpdaterClient = UpdaterClient || {};

UpdaterClient.init = function () {
    UpdaterClient.config.getConfig();

    // Wire up buttons to actions
    $('input').bind('input', UpdaterClient.validation.validateConfig);
    $('#ghost-zip').click(function () {
        $('.ghostPackageLoader').show();
    });
    $('#ghost-zip').change(function () {
        $(this).attr('disabled', false);
        $('.ghostPackageLoader').hide();
    });

    // TODO: Defining actions and handlers here is okay, but feels dirty.
    // This allows us to define actions with the data-action attribute.
    $('body').on('click', '[data-action]', function() {
        var action = $(this).data('action'),
            split = (action) ? action.split('.') : null,
            fn = window;
        
        for (var i = 0; i < split.length; i++) {
            fn = (fn) ? fn[split[i]] : null;
        }

        if (typeof fn === 'function') {
            fn.apply(null, arguments);
        }
    });

    $('#config').fadeIn(900);
};var UpdaterClient = UpdaterClient || {}; 

UpdaterClient.backup = {

    scriptsDeployed: false,
    deletingOldBackup: false,
    creatingBackup: false,
    backupFinished: false,
    bScriptLogArea: null,
    bScriptLog: null,
    scriptLogTitle: null,

    /**
     * Appends the backup log with additional text
     * @param  {string} text - Text to append
     * @param  {boolean} loading - Are we loading
     * @param  {boolean} error - Is this an error
     * @return {$ append}
     */
    appendLog: function (text, loading, error) {
        return UpdaterClient.utils.appendLog(text, loading, error, '#backupOutputArea');
    },

    /**
     * Appends an error to the output log
     * @param  {string} text - Error text to append to the log
     * @return {$ append}
     */
    appendError: function (text) {
        return this.appendLog(text, false, true);
    },

    /**
     * Creates UI indiciating that we're depoying backup scripts, but also
     * calls the GET 'deploy' endpoint, which will ultimately deploy the
     * backup scripts to Kudu
     * @param  {Function} callback
     */
    deployScripts: function (callback) {
        var self = this,
            nochanges = ' No changes to your site have been made.',
            error;

        this.appendLog('Deploying backup scripts to Azure Website', true);

        $.ajax('/backup/deploy').done(function (response) {
            if (response && response.error) {
                if (response.error.message && response.error.message.indexOf('ENOTFOUND') > -1) {
                    error = 'Website ' + UpdaterClient.config.url + ' could not be found. Please ensure that you are connected to the Internet ';
                    error += 'and that the address is correct and restart the updater.' + nochanges;
                    return self.appendError(error);
                } else {
                    return self.appendError(response.error);
                }
            }

            self.appendLog('Scripts successfully deployed');
            self.scriptsDeployed = true;

            if (callback) {
                return callback.call(self);
            }
        });
    },

    /**
     * Creates UI indicating that we're creating a remote backup, but also calls
     * the router endpoint kicking off the webjob that will ultimately create the
     * backup
     */
    makeBackup: function () {
        var self = this;
        this.appendLog('Instructing Azure to create backup (this might take a while)', true);
        
        $.post('/backup/create').done(function (response) {
            if (response) {
                console.log('Triggered create, getting status');
                self.getScriptStatus('create');
            }
        });
    },

    /**
     * Creates UI indicating that we're deleting a remote backup, but also calls
     * the router endpoint kicking off the webjob that will ultimately delete the
     * backup
     */
    deleteBackup: function () {
        var self = UpdaterClient.backup;

        $('#backup > .title').text('Deleting Backup');
        UpdaterClient.utils.switchPanel('#backup');
        self.appendLog('Instructing Azure to delete backup', true);
        
        $.post('/backup/delete').done(function (response) {
            if (response) {
                self.getScriptStatus('delete');
            }
        });
    },

    /**
     * Creates UI indicating that we're restoring a remote backup, but also calls
     * the router endpoint kicking off the webjob that will ultimately restore the
     * backup
     */
    restoreBackup: function () {
        var self = UpdaterClient.backup;

        $('#backup > .title').text('Restoring Backup');
        UpdaterClient.utils.switchPanel('#backup');
        self.appendLog('Instructing Azure to restore backup (this might take a while)', true);
        
        $.post('/backup/restore').done(function (response) {
            if (response) {
                self.getScriptStatus('restore');
            }
        });
    },

    /**
     * Helper function called by all three "kicking off a script" methods above,
     * getting the status for a specific script. This monster function gets the 
     * log URL from Kudu, pulls the log, and repeats the pulling until the script
     * has exited
     * @param  {string} script - Name of the script
     */
    getScriptStatus: function (script) {
        var self = UpdaterClient.backup;

        $.ajax({
            url: '/backup/' + script,
            dataType: 'text'
        }).done(function (response) {
            var repeat = false;

            if (response) {
                clearTimeout(self.timerYellow);
                clearTimeout(self.timerRed);

                self.timerYellow = setTimeout(function () {
                    UpdaterClient.utils.timerButton('yellow');
                }, 120000);
                self.timerRed = setTimeout(function () {
                    UpdaterClient.utils.timerButton('red');
                }, 300000);
                UpdaterClient.utils.timerButton('green');

                self.scriptLogTitle = self.scriptLogTitle || $('.scriptLogTitle');
                self.scriptLogTitle.show();
                self.bScriptLog = self.bScriptLog || $('#backupScriptLog');
                self.bScriptLog.text(response);
                self.bScriptLogArea = self.bScriptLogArea || $('#backupScriptLogArea');
                self.bScriptLogArea.show();
                self.bScriptLogArea.scrollTop(self.bScriptLogArea.scrollHeight);
            }

            if (response && !self.backupFinished && script === 'create') {
                // Done
                if (response.indexOf('Status changed to Success') > -1 && !self.backupFinished) {
                    self.appendLog('All done, initiating update!', false);
                    self.backupFinished = true;

                    setTimeout(function() {
                        UpdaterClient.updater.startInstallation();
                        self.bScriptLogArea.hide();
                        self.scriptLogTitle.hide();
                        self.bScriptLog.empty();
                        clearTimeout(self.timerYellow);
                        clearTimeout(self.timerRed);
                        UpdaterClient.utils.timerButton('grey');
                        $('#backupOutputArea').empty();
                    }, 300);
                } 

                // Removing old backup
                if (response.indexOf('Removing old backup') > -1 && !self.deletingOldBackup) {
                    self.appendLog('Removing old backup', true);
                    self.deletingOldBackup = true;
                }

                // Copying folder
                if (response.indexOf('Creating Full Site Backup') > -1 && !self.creatingBackup) {
                    self.appendLog('Backing up files', true);
                    self.creatingBackup = true;
                } 
                
                repeat = true;
            }

            if (response && script === 'delete') {
                // Done
                if (response.indexOf('Status changed to Success') > -1) {
                    self.appendLog('All done, backup deleted!', false);
                    self.appendLog('You can now close this tool.', false);
                } else {
                    repeat = true;
                }
            }

            if (response && script === 'restore') {
                // Done
                if (response.indexOf('Status changed to Success') > -1) {
                    self.appendLog('All done, backup restored. We\'re sorry that we could not update your blog, but everything is like it was before.', false);
                    self.appendLog('You can now close this tool.', false);
                } else {
                    repeat = true;
                }
            }

            if (repeat) {
                setTimeout(function() { self.getScriptStatus(script); }, 800);
            }
        });
    },

    /**
     * Starts the upgrade process *with* backup, as oppposed to starting it
     * without it.
     * TODO: This name is confusing
     */
    startBackup: function () {
        UpdaterClient.config.backup = true;
        UpdaterClient.utils.switchPanel('#backup');
        UpdaterClient.backup.deployScripts(UpdaterClient.backup.makeBackup);
    }
};var UpdaterClient = UpdaterClient || {};

UpdaterClient.config = {
    url: '',
    username: '',
    password: '',
    zippath: '',
    standalone: undefined,
    backup: false,

    /**
     * Takes the config entered by the user and hits the router configuration
     * endpoint, essentially telling the Node part of this app what the
     * configuration is.
     */
    setConfig: function () {
        if (UpdaterClient.validation.validateConfig('default')) {
            $.ajax({
                url: '/updater/config',
                data: { 
                    url: UpdaterClient.config.url, 
                    username: UpdaterClient.config.username, 
                    password: UpdaterClient.config.password, 
                    zippath: UpdaterClient.config.zippath 
                }
            })
            .done(function(response) {
                console.log(response);
                UpdaterClient.utils.switchPanel('#backupdisclaimer');
            });
        }
    },

    /**
     * Ensures that we're running in NW.js - and show's the file
     * upload option, if that's the case
     * TODO: This seemed smart in the beginning, but pointless now.
     * We're always running as an app.
     */
    getConfig: function () {
        $.ajax('/nw').done(function (response) {
            console.log(response);
            if (response.isNodeWebkit) {
                UpdaterClient.config.standalone = true;
                $('#ghost-zip-container').show();
            }
        });
    }
};

var UpdaterClient = UpdaterClient || {}; 

UpdaterClient.updater = {

    updateFinished: false,
    scriptRunning: false,
    scriptLogTitle: null,
    scriptLogArea: null,
    scriptLog: null,
    timerCircle: null,
    timerYellow: null,
    timerRed: null,

    /**
     * Appends the updater log with additional text
     * @param  {string} text - Text to append
     * @param  {boolean} loading - Are we loading
     * @param  {boolean} error - Is this an error
     * @return {$ append}
     */
    appendLog: function (text, loading, error) {
        return UpdaterClient.utils.appendLog(text, loading, error, '#updateOutputArea');
    },

    /**
     * Appends an error to the output log
     * @param  {string} text - Error text to append to the log
     * @return {$ append}
     */
    appendError: function (text) {
        return this.appendLog(text, false, true);
    },

    /**
     * Hit's the 'upload' router endpoint, eventually attempting to
     * upload the user-defined zip-file to the Azure Web App
     * @param  {boolean} propagate - Should we continue with deploying once this is done?
     */
    uploadGhost: function (propagate) {
        var self = UpdaterClient.updater, 
            nochanges = ' No changes to your site have been made.',
            error;

        this.appendLog('Uploading Ghost package to Azure Website (this might take a while)', true);

        $.ajax('/updater/upload').done(function(response) {

            if (response.error || response.statusCode >= 400) {
                console.log('Error: ', response);

                if (response.statusCode === 401) {
                    error = 'Azure rejected the given credentials - username and password are incorrect,';
                    error += 'or are not correct for ' + UpdaterClient.config.url + '.' + nochanges;
                } else if (response.statusCode === 412) {
                    error = 'The filesystem at ' + UpdaterClient.config.url + ' does not accept the upload of the Ghost package.';
                    error +=  nochanges;
                } else if (response.error.code === 'ENOTFOUND' || (response.error.message && response.error.message.indexOf('ENOTFOUND') > -1)) {
                    error = 'Website ' + UpdaterClient.config.url + ' could not be found. Please ensure that you are connected to the Internet ';
                    error += 'and that the address is correct and restart the updater.' + nochanges;
                } else {
                    error = response.error + nochanges;
                }
                self.appendError(error);
            } else if (response.statusCode === 201) {
                self.appendLog('Ghost package successfully uploaded');
                if (propagate) {
                    self.deployScript(propagate);
                }
            }

        });
    },

    /**
     * Hit's the 'deploy updater' endpoint on the router, eventually
     * attempting to upload the updater webjobs to the Azure Web App
     * @param  {boolean} propagate - Should we trigger the script once this is done?
     */
    deployScript: function (propagate) {
        var self = this;
        this.appendLog('Deploying update script to Azure Website');

        $.ajax('/updater/deploy').done(function(response) {
            if (response.statusCode >= 200 && response.statusCode <= 400) {
                var responseBody = JSON.parse(response.body);
                
                if (responseBody.url) {
                    self.appendLog('Script successfully deployed (' + responseBody.name + ')');
                    if (propagate) {
                        self.triggerScript(propagate);
                    }
                }
            }
        });
    },

    /**
     * Hit's the 'trigger updater' endpoint on the router, eventually
     * attempting to trigger the 'updater' webjob on the Azure Web App
     * @param  {boolean} propagate - Should we get the script's status once this is done?
     */
    triggerScript: function (propagate) {
        var self = this;
        this.appendLog('Starting Update script on Azure Website', true);
        
        $.ajax('/updater/trigger').done(function(response) {
            if (response.statusCode >= 200 && response.statusCode <= 400) {
                if (propagate) {
                    self.getScriptStatus(propagate);
                }
            }
        });
    },

    /**
     * Hit's the 'updater info' endpoint on the router, attempting to get
     * the log of the 'updater webjob'. This will only work if the script
     * is running.
     */
    getScriptStatus: function () {
        var self = this;

        if (!this.scriptRunning) {
            this.appendLog('Trying to get status of update script on Azure Website', true);
            this.scriptRunning = true;
        }

        $.ajax({
            url: '/updater/info',
            dataType: 'text'
        }).done(function (response) {
            if (response && !self.updateFinished) {   
                clearTimeout(self.timerYellow);
                clearTimeout(self.timerRed);

                self.timerYellow = setTimeout(function () {
                    UpdaterClient.utils.timerButton('yellow');
                }, 120000);
                self.timerRed = setTimeout(function () {
                    UpdaterClient.utils.timerButton('red');
                }, 300000);
                UpdaterClient.utils.timerButton('green');

                self.scriptLogTitle = self.scriptLogTitle || $('.scriptLogTitle');
                self.scriptLogTitle.show();            
                self.scriptLog = self.scriptLog || $('#updateScriptLog');
                self.scriptLog.text(response);
                self.scriptLog.show();
                self.scriptLogArea = self.scriptLogArea || $('#updateScriptLogArea');
                self.scriptLogArea.show();
                self.scriptLogArea.scrollTop(self.scriptLogArea.scrollHeight);

                if (response.indexOf('Status changed to Success') > -1) {
                    // We're done!
                    self.scriptLogArea.hide();
                    self.scriptLogTitle.hide();
                    self.scriptLog.empty();
                    UpdaterClient.utils.timerButton('grey');
                    clearTimeout(self.timerYellow);
                    clearTimeout(self.timerRed);
                    self.appendLog('All done, your blog has been updated!', false);
                    self.updateFinished = true;

                    setTimeout(function() { UpdaterClient.utils.switchPanel('#updatefinished'); }, 500);
                }
                
                setTimeout(function() { self.getScriptStatus(); }, 800);
            }
        }).fail(function (error) {
            console.log(error);

            if (!self.updateFinished) {
                setTimeout(function() { self.getScriptStatus(); }, 1000);
            }
        });

    },
    
    /**
     * Kicks off the whole 'update Ghost' chain, involving all the methods
     * above.
     */
    startInstallation: function () {
        UpdaterClient.utils.switchPanel('#update');
        UpdaterClient.updater.uploadGhost(true);
    }
};var UpdaterClient = UpdaterClient || {}; 

UpdaterClient.utils = {

    /**
     * Switch the different 'panels' the app. Poor man's SPA.
     * @param  {object} input - Input object with target information
     */
    switchPanel: function (input) {
        var panel = (input.target) ? input.target.dataset.target : input;
        $('.wrapper').hide();
        $(panel).show();
    },

    /**
     * Append text to the log element in the DOM.
     * @param  {string} text - The text to append
     * @param  {boolean} loading - Are we loading?
     * @param  {boolean} error - Is this an error?
     * @param  {element|string} target - The target object
     * @return {$.append}
     */
    appendLog: function (text, loading, error, target) {
        var loader = '',
        errorText = (error) ? '<span class="error">Error: </span>' : '';

        if ($('#loading')) {
            $('#loading').remove();
        }

        loader = (loading) ? ' <img id="loading" src="/images/loading.gif" />' : '';
        return $(target).append('<p>' + errorText + text + loader + '</p>');
    },

    /**
     * A button that indicates how long ago we've last had contact to Kudu and the
     * Azure Web App. This is useful because we have virtually no way of telling
     * if something went horribly wrong - ie connection lost, server down, datacenter
     * on fire, etc.
     * @param  {string} color - The color the button should be (red/yellow/grey/green)
     */
    timerButton: function (color) {
        var timerCircle = $('.circle'),
            timerTooltip = $('.circle > span'),
            textKeepTrying = '\nThis tool will keep trying to reach the website.',
            textRed = 'We have not heard back from the websites within the last five minutes, which can indicate a problem.' + textKeepTrying,
            textYellow = 'We have not heard back from the website within the last two minutes.' + textKeepTrying,
            textGrey = 'The connection status to your Azure Website is currently unknown.',
            textGreen = 'We are connected to your Azure Website.';

        switch (color) {
            case 'red':
                timerCircle.css('background-color', '#e55b5b');
                timerTooltip.text(textRed);
                break;
            case 'yellow':
                timerCircle.css('background-color', '#ffe811');
                timerTooltip.text(textYellow);
                break;
            case 'grey':
                timerCircle.css('background-color', '#7f7f7f');
                timerTooltip.text(textGrey);
                break;
            case 'green':
                timerCircle.css('background-color', '#799a2e');
                timerTooltip.text(textGreen);
                break;
            default:
                break;
        }
    }

};var UpdaterClient = UpdaterClient || {};

UpdaterClient.validation = {

    /**
     * One giant validation method, taking an event and running
     * some basic validation against a targeted input element.
     * @param  {object} e - event
     */
    validateConfig: function (e) {
        var urlRegex = /\**..(.azurewebsites.net)/,
            result = true,
            username, password, zippath, url;
        
        e = (e.target) ? e.target.id : e;

        switch (e) {
            case 'blog-url':
                UpdaterClient.config.url = $('#blog-url').val();
                url = UpdaterClient.config.url;
                if (!url || !urlRegex.test(url)) {
                    $('#blog-url').addClass('invalid');
                    result = false;
                } else if (urlRegex.test(url)) {
                    $('#blog-url').removeClass('invalid');
                }

                break;
            case 'blog-username':
                UpdaterClient.config.username = $('#blog-username').val();
                username = UpdaterClient.config.username;
                if (!username) {
                    $('#blog-username').addClass('invalid');
                    result = false;
                } else if (username) {
                    $('#blog-username').removeClass('invalid');
                }

                break;
            case 'blog-password':
                UpdaterClient.config.password = $('#blog-password').val();
                password = UpdaterClient.config.password;
                if (!password) {
                    $('#blog-password').addClass('invalid');
                    result = false;
                } else if (password) {
                    $('#blog-password').removeClass('invalid');
                }

                break;
            case 'ghost-zip':
                UpdaterClient.config.zippath = $('#ghost-zip').val();
                zippath = UpdaterClient.config.zippath;
                if (!zippath) {
                    $('#ghost-zip').addClass('invalid');
                    result = false;
                } else if (zippath) {
                    $('#ghost-zip').removeClass('invalid');
                }
                
                break;
            default:
                var testUrl = this.validateConfig('blog-url'),
                    testPassword = this.validateConfig('blog-password'),
                    testUsername = this.validateConfig('blog-username'),
                    testZippath;

                if (UpdaterClient.config.standalone) {
                    testZippath = this.validateConfig('ghost-zip');
                } else {
                    testZippath = true;
                }
                    
                if (!testUrl || !testUsername || !testPassword || !testZippath) {
                    result = false;
                }   

                break;
        }

        return result;
    }
};