---
title: Reference Files
description: UI Components and Types to support uploading files in to a C3 Application and allowing them to be downloaded.
---

# Reference Files

Allows display and management of reference files within a C3 application that uses React for its UI.

## Fetures

* Upload files from the UI.
* Files are saved to the default filestore configured for the C3 environment (such as Azure Blob).
* Files are displayed on 'pages', grouping related files together.
* Files are sorted by date, with newest first.
* Both files and pages can have descriptions.
* Admin Controls can have visibility limited to specific groups.
* Admin Controls can be temporarily removed to simulate what an end user will see.
* All pages, files, descriptions can be maintained from the UI without needing to use the static console.

### Limitations / Cautions

* While pages can be created in the UI, they cannot be deleted. If a page needs to be deleted, the static console must be used.
* End user groups and admin user groups need to be given the correct permissions in the C3 app. See the section on setup.

# Set up

Enable this feature as follows.

## Copy Source Files

The files in the `src` folder should be copied to anywhere within your C3 application's `src` folder.
We recommend putting them in their own subfolder.

The files in the `ui` folder should be copied to anywhere within your application's UI source folder.
We recommend putting them in their own subfolder.
You will need to import a reference to them in your code, but othewise the location does not matter.

If not already there, the following will need to be added to your React UI's `package.json`.
`"axios": "^0.18.0","cachios": "^1.1.0","cookies-js": "^1.2.3","prop-types": "^15.7.2","semantic-ui-react": "^0.81.0"`

## Grant User Access

Edit your application's `Role` definition to grant access to the needed functionality.
This will typically be done by adding permissions to the role's JSON file in the `seed` folder.
Admin users also need the end users permissions if not in a corresponding role already.

**For End Users**

* "allow:ReferenceFile:read:"
* "allow:ReferencePage:read:"

Depending on C3 version and filesystem, you may need to grant access to open filesystem files, if not already granted. For example: `"allow:AzureFileSystem::openFile"`.

**For Admin Users**

* "allow:ReferencePage:write:"
* "allow:ReferenceFile::createFile"
* "allow:ReferenceFile::editFile"

## Add Component To Application

On the page you want to display the feature you will need to import it. Make sure the folder path is correct based on your current file and where you placed this file.
Then, simply add the component where you want it to display.

```jsx
import React from 'react';
import ReferenceFiles from './ReferenceFiles.js';
export default class MyApplicationPage extends React.Component {
  render() { return <div>
    <ReferenceFiles 
      title="Reference Files"
      subtitle="These are reference files for the application"
      admin={["C3.Group.Developer"]}
    />
  </div>}
}
```

The component can accept the following properties:

```js
propTypes = {
  /**
   * Page Title. If a title is given, will display a file icon by it.
   */
  title: PropTypes.string,
  /**
   * Subtitle for the Page. Must also provide title or it will be ignored.
   */
  subtitle: PropTypes.string,
  /**
   * c3 User object. If needed and not given, will get on its own. Provide if already available to reduce network calls.
   */
  user: PropTypes.object,
  /**
   * Group name(s) controlling admin functions. If not given, everyone sees them.
   */
  admin: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  /**
   * If provided, only retrieves this page id and no others.
   */
  forcePage: PropTypes.string
}
```
