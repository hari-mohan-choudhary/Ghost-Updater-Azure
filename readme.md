## Ghost Updater for Microsoft Azure
Microsoft Azure allows a one-click installation of the popular blogging platform Ghost, but there's currently no integrated update option. This desktop app automatically upgrades Ghost running on Azure Web Apps (formerly known as Azure Websites) in a few clicks. It is being maintained by members of the Microsoft DX team with :heart: for Ghost!

***Latest version known to update without errors: 0.7.8***

![](https://raw.githubusercontent.com/felixrieseberg/Ghost-Updater-Azure/master/docs/screens.png)

### Download
- [Windows](https://github.com/felixrieseberg/Ghost-Updater-Azure/releases/download/v0.6.1/GhostUpdater-0.6.1-win.zip) - [Mac OS X](https://github.com/felixrieseberg/Ghost-Updater-Azure/releases/download/v0.6.1/GhostUpdater-0.6.1-osx.dmg) - [Linux](https://github.com/felixrieseberg/Ghost-Updater-Azure/releases/download/v0.6.1/GhostUpdater-0.6.1-linux.zip)

### How To Update your Ghost Blog
Good news: It's really simple. You only need two things: The [latest version of Ghost as a zip package](https://ghost.org/download) and your deployment credentials for your website. Those credentials are _not_ the user/password pair used to log into the Azure Management Portal, so let's quickly talk about how to get them:

- Go to your website's dashboard in the Azure Management Portal. 
- Under *Quick Links* on the right, you'll see *Reset Deployment Credentials*. If you're using the new portal, you'll find a *Set Deployment Credentials* button in the dashboard right in the *Deployment* section.

![](https://raw.githubusercontent.com/felixrieseberg/Ghost-Updater-Azure/master/docs/password-screen2.png)

> Please ensure that your Web App / Website has enough resources for the update. Should the update stall or abort while running, increase the available resources for your Web App (for instance by temporarily moving it to a bigger instance) and run the updater again.

### Support
If you run into any issues, please go and report them in the [issue section of the GitHub repository](https://github.com/felixrieseberg/Ghost-Updater-Azure/issues).

We at Microsoft love Ghost, which is why we release this code. It is not an official Microsoft product - there is no warranty of any kind. Please see License.md if you have any questions.

### License
The MIT License (MIT), Copyright (c) 2014 Felix Rieseberg & Microsoft Corporation. Please see License.md for details.
