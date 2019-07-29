import React from 'react';
import PropTypes from 'prop-types';
import { Input, Icon, Button, Loader, Form, Message, Confirm, Modal, Header } from 'semantic-ui-react'
import _ from 'lodash';
import axios from 'axios';
const cachios = require('cachios');
const Cookies = require('cookies-js');

//Properties for ReferenceFiles
const PropsReferenceFiles = {
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
//Properties for ReferenceFileList (Non-exported component)
const PropsReferenceFileList = {
  /**
   * Id of the page to list files for.
   */
  page: PropTypes.string.isRequired,
  /**
   * If true, show admin functionality for files
   */
  admin: PropTypes.bool,
  /**
   * Can be used to force a re-fetch.
   * If this is different than previous, will re-fetch
   */
  now: PropTypes.any
}
//Properties for ReferenceFileUploader (Non-exported component)
const PropsReferenceFileUploader = {
  /**
   * Page id the file will be uploaded to.
   */
  page: PropTypes.string.isRequired,
  /**
   * Callback to be run after an upload. Receives created file URL/ID as parameter.
   */
  onUpload: PropTypes.func,
  /**
   * callback to be run on an error.
   */
  onError: PropTypes.func
}

/**
 * Headers for API Calls
 */
function apiHeaders() {
  var headers = {
    Accept: "application/json"
  };
  var c3auth = window.localStorage.getItem('c3auth');
  if(c3auth) {
    headers.Authorization = c3auth
  }
  return headers;
}
/**
 * Base URL for API Calls
 * @param {string} apiType either empty, 'api' (defualt), or 'file'
 */
function apiUrl(apiType) {
  const LOCAL = 'http://localhost:3000';
  const DEFAULT_API = 'api';
  let api = apiType ? apiType : DEFAULT_API;
  let curUrl = window.location.origin;
  let c3tenant = Cookies.get('c3tenant');
  let c3tag = Cookies.get('c3tag');
  let devOverride = window.localStorage.getItem('c3baseurl');
  let res = null;
  // Allows developers to store the desired environment in local storage
  if (devOverride && curUrl.startsWith(LOCAL)) {
    res = devOverride;
    // We may also need to override the tenant/tag
    c3tenant = window.localStorage.getItem('c3tenant');
    c3tag = window.localStorage.getItem('c3tag');
  } else {
    res = curUrl;
  }
  //If you want a specific environment for local testing, update 'c3baseurl', 'c3tenant', 'c3tag' in localStorage
  return `${res}/${api}/1/${c3tenant}/${c3tag}/`;
}
/**
 * Displays pages of references files and allows uploading more files.
 */
class ReferenceFiles extends React.Component {
  constructor(props) {
      super(props);
      this.state = {
        page: '',
        pageInfo: {},
        editPage: null,
        newPage: null,
        pages: [],
        now: (new Date()).getTime(),
        loading: false,
        admin: true
      };
  }
  /**
   * componentDidMount
   */
  componentDidMount(){
    this.clearAndFetch();
  }
  /**
   * Reset to mostly initial state and fetch data
   */
  clearAndFetch(){
    this.setState({
      page:'',
      pageInfo: {},
      editPage: null,
      newPage: null,
      pages: [],
      loading: false,
      admin: true
    },this.fetchData());
  }
  /**
   * fetchData
   * 
   * Gets the page lists, and (if needed) the user info
   */
  fetchData(){
    var that = this;
    //Determine if need a user fetch
    var userFetch = false;
    if ( this.props.admin && !this.props.user ) { 
      userFetch = true;
    }
    //Determine if forced page
    var filter = '';
    if ( this.props.forcePage ) {
      filter = 'id=="'+this.props.forcePage+'"'
    }
    // begin fetching data, lets cancel the existing request if any.
    this.cancelPendingReqs();
    this._source = axios.CancelToken.source();
    var reqSettings = {
      ttl: 360,
      headers: apiHeaders(),
      timeout: 20000,
      cancelToken: that._source.token
    };
    var reqs = [];
    //Request for Pages
    reqs.push(axios.post(apiUrl() + 'ReferencePage?action=fetch',
        { spec: {
          order: 'sort',
          filter: filter
        }}, reqSettings
    ));
    //Request for User
    if ( userFetch ) {
      reqs.push(cachios.post(apiUrl() + 'User?action=myUser',
        {}, reqSettings
      ));
    }
    //All Responses Complete
    axios.all(reqs).then((res) => {
      var state = {};
      //Update Page List
      var pageRes = res ? res[0] || {} : {};
      state.pages = pageRes.data ? pageRes.data.objs || [] : [];
      if ( that.props.forcePage ) {
        state.page = state.pages[0] ? state.pages[0].id : '';
      }
      //Update User Info
      if ( userFetch ) {
        var userRes = res ? res[1] || {} : {};
        state.user = userRes.data || {};
      }
      //Determine if user can admin
      if ( that.props.admin ) {
        //Default the state to no admin
        state.admin = false;
        var groups = [];
        var admin = that.props.admin;
        if ( state.user && state.user.groups ) { groups = state.user.groups; }
        else if ( that.props.user && that.props.user.groups ) { groups = that.props.user.groups; }
        if ( !Array.isArray(admin) ) { admin = [admin]; }
        _.each(admin, (a)=>{
          _.each(groups, (g)=>{
            if ( !g ) { return };
            //If the user has an admin group, set state to true
            if ( g.id === a ) { state.admin = true; }
          })
        });
      }
      //Update State
      that.setState(state);
    }).catch((thrown) => { //Error with Request
      if (!axios.isCancel(thrown)) { //Not Cancelled
        that.setState({
          loading: false,
          pages: [],
          requestError: thrown
        });
        console.error('fetchData Error\n',thrown);
      }
    });
  }
  /**
   * cancelPendingReqs
   */
  cancelPendingReqs(){
    if (typeof this._source !== typeof undefined) {
      this._source.cancel('Operation canceled due to new request.')
    }
  }
  /**
   * handle input for edit modal
   */
  handleEditInput(e,d) {
    var edit = this.state.editPage;
    if (!edit.id) { return; }
    edit[d.name] = d.value;
    this.setState({editPage: edit});
  }
  /**
   * handle input for new page modal
   */
  handleNewInput(e,d) {
    var page = this.state.newPage;
    if ( page === null || typeof page === 'undefined' ) { return; }
    page[d.name] = d.value;
    this.setState({newPage: page});
  }
  /**
   * edit a page in state.editPage
   */
  onConfirmEditPage() {
    var page = this.state.editPage || {};
    if ( !page.id ) { return; }
    var that = this;
    var pageProp = {
      id: page.id,
      description: page.description,
      name: page.name,
      sort: page.sort
    }
    axios.post(apiUrl() + 'ReferencePage?action=merge',
      { 
        this: pageProp
      }, {
        ttl: 360,
        headers: apiHeaders(),
        timeout: 20000,
      }
    ).then((res) => {
      that.clearAndFetch();
    }).catch((thrown) => { //Error with Request
      if (!axios.isCancel(thrown)) { //Not Cancelled
        that.setState({
          loading: false,
          editPage: null,
          requestError: thrown
        });
        console.error('onConfirmedEditPage Error\n',thrown);
      }
    });
  }
  /**
   * create a page in state.newPage
   */
  onConfirmNewPage() {
    var page = this.state.newPage || {};
    if ( !page.name ) { return; }
    var that = this;
    var pageProp = {
      id: page.id || null,
      name: page.name,
    }
    axios.post(apiUrl() + 'ReferencePage?action=create',
      { 
        this: pageProp
      }, {
        ttl: 360,
        headers: apiHeaders(),
        timeout: 20000,
      }
    ).then((res) => {
      that.clearAndFetch();
    }).catch((thrown) => { //Error with Request
      if (!axios.isCancel(thrown)) { //Not Cancelled
        that.setState({
          loading: false,
          newPage: null,
          requestError: thrown
        });
        console.error('onConfirmNewPage Error\n',thrown);
      }
    });
  }
  /**
   * renderHeader
   */
  renderHeader() { return (
    this.props.title ? 
      <h2 className="ui header">
        <i className="circular file alternate icon"></i>
        <div className="content">
          {this.props.title}
          { this.props.subtitle ? 
            <div className="sub header">{this.props.subtitle}</div>
          : (null)}
        </div>
      </h2>
    : (null)
  )}
  /**
   * renderPageList
   */
  renderPageList() { 
    var that = this;
    return (
    <div style={{margin: '1rem'}}>
      <Button.Group>
      {_.map(this.state.pages, (page) => (
        <Button key={page.id}
          onClick={()=>{that.setState({page: page.id, pageInfo: page})}}
          primary={page.id === this.state.page}
        >
          {page.name}
        </Button>
      ))}
      </Button.Group>
    </div>
  )}
  /**
   * renderPageinfo
   */
  renderPageInfo() { 
    if ( !this.state.pageInfo || !this.state.page ) { return null; }
    if ( !this.state.pageInfo.description ) { if ( !this.state.admin ) { return null; } }
    return (
    <div style={{
      margin: '1rem', padding: '1rem', fontSize: '16px',
      backgroundColor: "#f0fbfd", border: '1px solid #bbb'
    }}>
      {this.state.pageInfo.description||''}
      { this.state.admin ? <div style={{marginTop:'1rem'}}>
        <Button compact size="tiny" loading={this.state.loading}
          onClick={()=>this.setState({editPage: this.state.pageInfo})}
        >Edit Page</Button>
        <span style={{fontSize:'0.8rem', marginLeft:'2rem'}}>Page List Order (Smaller Numbers First): {this.state.pageInfo.sort}</span>
        <Modal open={this.state.editPage?true:false} onClose={()=>this.setState({editPage:null})}>
          <Header content={"Edit Page "+(this.state.editPage?this.state.editPage.name||'':'')}/>
          <Modal.Content>
            <Form>
              <Form.Group>
              <Form.Field width={10}>
                <label>Name</label>
                <Input
                  name="name" value={this.state.editPage?this.state.editPage.name||'':''}
                  onChange={(e,d)=>this.handleEditInput(e,d)} />
              </Form.Field>
              <Form.Field width={6}>
                <label>Order (Smaller Numbers First)</label>
                <Input
                  name="sort" value={this.state.editPage?this.state.editPage.sort||'':''}
                  onChange={(e,d)=>this.handleEditInput(e,d)} />
              </Form.Field>
              </Form.Group>
              <Form.Group>
              <Form.Field width={16}>
                <label>Descriptions</label>
                <Input placeholder="Optional Description..."
                  name="description" value={this.state.editPage?this.state.editPage.description||'':''}
                  onChange={(e,d)=>this.handleEditInput(e,d)} />
              </Form.Field>
              </Form.Group>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button primary onClick={()=>this.setState({loading:true},this.onConfirmEditPage())}>Save</Button>
            <Button negative onClick={()=>this.setState({editPage:null})}>Cancel</Button>
          </Modal.Actions>
        </Modal>
      </div>
      :(null)}
    </div>
  )}
  /**
   * renderPageAdmin
   */
  renderPageAdmin() { return (
    <div style={{margin: '1rem', padding: '1rem', border: '1px solid #bbb', backgroundColor: '#f0fbfd'}}>
      <Button size="small" primary style={{float:'left'}} loading={this.state.loading}
        onClick={()=>this.setState({newPage:{name: 'New Page'}})}
      >Add New Page</Button>
      <Modal open={this.state.newPage?true:false} onClose={()=>this.setState({newPage:null})}>
        <Header content="New Page" />
        <Modal.Content>
          <Form>
            <Form.Group>
            <Form.Field width={6}>
              <label>ID</label>
              <Input
                name="id" value={this.state.newPage?this.state.newPage.id||'':''}
                onChange={(e,d)=>this.handleNewInput(e,d)} />
            </Form.Field>
            <Form.Field width={10}>
              <label>Name</label>
              <Input
                name="name" value={this.state.newPage?this.state.newPage.name||'':''}
                onChange={(e,d)=>this.handleNewInput(e,d)} />
            </Form.Field>
            </Form.Group>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button primary onClick={()=>this.setState({loading:true},this.onConfirmNewPage())}>Save</Button>
          <Button negative onClick={()=>this.setState({newPage:null})}>Cancel</Button>
        </Modal.Actions>
      </Modal>
      <Button size="small" negative style={{float:'right'}}
        onClick={()=>this.setState({admin:false})}
      >Disable Admin Controls</Button>
      <div style={{clear: 'both'}} />
    </div>
    )}
  /**
   * render
   */
  render() { return (
    <div>
        { this.renderHeader() }
        { this.renderPageList() }
        { this.renderPageInfo() }
        { this.state.page ?
          <ReferenceFileList key='filelist' 
            page={this.state.page}
            now={this.state.now}
            admin={this.state.admin}
          />
        :(null)}
        { this.state.page && this.state.admin ?
          <ReferenceFileUploader key='fileuploader' 
            page={this.state.page}
            onUpload={()=>this.setState({now: (new Date()).getTime()})}
            onError={null}
          />
        :(null)
        }
        {this.state.admin ?
          this.renderPageAdmin()
        :(null)}
    </div>
  )}
}
/**
 * Displays the files belonging to the given page.
 */
class ReferenceFileList extends React.Component {
  constructor(props) {
      super(props);
      this.state = {
        files: [],
        loading: false,
        remove: null,
        edit: null
      };
  }
  /**
   * componentDidMount
   */
  componentDidMount(){
    this.clearAndFetch();
  }
  componentDidUpdate(prevProps){
    if ( prevProps.page !== this.props.page ) {
      this.clearAndFetch();
    }
    if ( this.props.now && prevProps.now !== this.props.now ) {
      this.clearAndFetch();
    }
  }
  /**
   * clearAndFetch
   */
  clearAndFetch(){
    this.setState({
      loading: true,
      files: [],
      remove: null,
      edit: null
    }, this.fetchData());
  }
  /**
   * fetchData - Gets list of files
   */
  fetchData(){
    var that = this;
    // begin fetching data, lets cancel the existing request if any.
    this.cancelPendingReqs();
    this._source = axios.CancelToken.source();
    var reqSettings = {
      ttl: 360,
      headers: apiHeaders(),
      timeout: 20000,
      cancelToken: that._source.token,
    };
    axios.post(apiUrl() + 'ReferenceFile?action=fetch',
        { spec: {
            filter: 'page=="'+(this.props.page||'')+'"',
            order: 'descending(effectiveDate)'
          }
        }, reqSettings
    ).then((res) => {
      var state = {loading: false};
      state.files = res && res.data ? res.data.objs || [] : [];
      that.setState(state);
    }).catch((thrown) => { //Error with Request
      if (!axios.isCancel(thrown)) { //Not Cancelled
        that.setState({
          loading: false,
          files: [],
          requestError: thrown
        });
        console.error('fetchData Error\n',thrown);
      }
    });
  }
  /**
   * cancelPendingReqs
   */
  cancelPendingReqs(){
    if (typeof this._source !== typeof undefined) {
      this._source.cancel('Operation canceled due to new request.')
    }
  }
  /**
   * delete a file in state.remove
   */
  onConfirmDeleteFile(){
    var that = this;
    var file = this.state.remove || {};
    if ( !file.id ) { return; }
    axios.post(apiUrl() + 'ReferenceFile?action=editFile',
      { 
        file: {id: file.id},
        remove: true
      }, {
        ttl: 360,
        headers: apiHeaders(),
        timeout: 20000,
      }
    ).then((res) => {
      that.clearAndFetch();
    }).catch((thrown) => { //Error with Request
      if (!axios.isCancel(thrown)) { //Not Cancelled
        that.setState({
          loading: false,
          requestError: thrown
        });
        console.error('onConfirmDeleteFile Error\n',thrown);
      }
    });
    //console.log("Delete "+id);
  }
  /**
   * edit a file in state.edit
   */
  onConfirmEditFile() {
    var file = this.state.edit || {};
    if ( !file.id ) { return; }
    var newDate = null;
    if ( file.newDate ) {
      try {
        //Not ideal way of doing this, as timezone gets messed up.
        var parts = /([0-9]{4})[^0-9]?([0-9]{2})[^0-9]?([0-9]{2}).*/.exec(file.newDate);
        newDate = new Date(parts[1],parts[2]-1,parts[3]);
      } catch (e) {
        console.error('Bad Date Format, expecting YYYY-MM-DD\n',e);
      }
    }
    var that = this;
    var fileProp = {
      id: file.id,
      description: file.description,
      note: file.note
    }
    if ( newDate ) { fileProp.effectiveDate = newDate.toISOString(); }
    axios.post(apiUrl() + 'ReferenceFile?action=editFile',
      { 
        file: fileProp
      }, {
        ttl: 360,
        headers: apiHeaders(),
        timeout: 20000,
      }
    ).then((res) => {
      that.clearAndFetch();
    }).catch((thrown) => { //Error with Request
      if (!axios.isCancel(thrown)) { //Not Cancelled
        that.setState({
          loading: false,
          requestError: thrown
        });
        console.error('onConfirmEditFile Error\n',thrown);
      }
    });
    //console.log("Edit "+file.id);
  }
  /**
   * handle input for edit modal
   */
  handleEditInput(e,d) {
    var edit = this.state.edit;
    if (!edit.id) { return; }
    edit[d.name] = d.value;
    this.setState({edit: edit});
  }
  /**
   * render admin controls
   */
  renderAdmin(file) { return [
    <Button key='removeButton' negative onClick={()=>this.setState({remove: file})}>
      Delete
    </Button>,
    <Confirm key='removeConfirm' open={this.state.remove?true:false}
      onCancel={()=>this.setState({remove:null})} onConfirm={()=>this.onConfirmDeleteFile()}
    />,
    <Button key='editButton' onClick={()=>this.setState({edit: file})}>
      Edit
    </Button>,
    this.renderEdit()
  ]}
  /**
   * render edit modal
   */
  renderEdit() { return (
    <Modal key='editModal' open={this.state.edit?true:false} onClose={()=>this.setState({edit:null})}>
      <Header content={"Edit Information for "+(this.state.edit?this.state.edit.name||'':'')}/>
      <Modal.Content>
        <Form>
          <Form.Group>
          <Form.Field width={8}>
            <label>Description</label>
            <Input placeholder="Optional File Description..." 
              name="description" value={this.state.edit?this.state.edit.description||'':''}
              onChange={(e,d)=>this.handleEditInput(e,d)} />
          </Form.Field>
          <Form.Field width={8}>
            <label>Note</label>
            <Input placeholder="Optional Additional Note..."
              name="note" value={this.state.edit?this.state.edit.note||'':''}
              onChange={(e,d)=>this.handleEditInput(e,d)} />
          </Form.Field>
          </Form.Group>
          <Form.Group>
            <Form.Field width={8}>
              {/* Would be better to have a calendar selection */}
              <label>Replace Date (Enter as YYYY-MM-DD, or leave blank to keep current)</label>
              <Input name="newDate"
                value={this.state.edit?this.state.edit.newDate||'':''}
                onChange={(e,d)=>this.handleEditInput(e,d)} />
            </Form.Field>
          </Form.Group>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button primary onClick={()=>this.onConfirmEditFile()}>Save</Button>
        <Button negative onClick={()=>this.setState({edit:null})}>Cancel</Button>
      </Modal.Actions>
    </Modal>
  )}
  /**
   * render
   */
  render() {
    var that = this;
    return (
    <div>
      { this.state.loading ? 
        <Loader active inline>Loading</Loader>
      :(null)}
      { !this.state.files || this.state.files.length < 1 ?
        <div style={{border: '2px solid #ddf', padding: '1rem', margin: '1rem'}}>No Files</div>
      :(null)}
      {_.map(this.state.files,(file)=>(
        <div style={{border: '2px solid #ddf', margin: '1rem', padding: '0.5rem', backgroundColor: '#fcfcfc'}} key={file.id}>
          <div>
            <div style={{fontSize: '1.2rem', fontWeight: 'bold', float: 'left'}}>
              {file.name}
            </div>
            <div style={{float: 'right'}}>
              { that.props.admin ?
                that.renderAdmin(file)
              :(null)}
              <a href={apiUrl("file")+""+file.id}
                className='ui secondary button' download target="_blank" type={file.contentType}
              >Download</a>
            </div>
            <div style={{clear: 'both'}} />
          </div>
          {file.description ? <div style={{marginBottom: '0.4rem'}}>{file.description}</div> : (null) }
          {file.note ? <div style={{fontStyle: 'italic', marginBottom: '0.4rem'}}>{file.note}</div> : (null) }
          <div>
            <span style={{marginRight: '2rem'}}>Type: {file.contentType}</span>
            <span style={{marginRight: '2rem'}}>Date: {file.effectiveDate ? (new Date(file.effectiveDate)).toLocaleString() : (null) }</span>
            <span style={{marginRight: '2rem'}}>Size: {file.size ? Math.round(file.size / 1024) : 0} KB</span>
          </div>
        </div>
      ))}
    </div>
  )}
}
/**
 * Shows Controls for Uploading a File and submits the API calls to upload the file.
 */
class ReferenceFileUploader extends React.PureComponent {
  constructor(props) {
      super(props);
      this.state = {
        loading: false,
        desc: '',
        note: '',
        uploaded: false
      };
  }
  /**
   * Upload the File to C3
   * @param {File} file Web-API File Object, with additional optional 'desc', and 'note' properties
   * @param {string} content Base64 enconded file content
   */
  postFile(file, content) {
    var that = this;
    var page = that.props ? that.props.page : 'TEST';
    that._source = axios.CancelToken.source();
    var reqSettings ={
      ttl: 360,
      headers: apiHeaders(),
      timeout: 120000,
      cancelToken: that._source.token
    };
    //Issue Post Call
    axios.post(apiUrl() + 'ReferenceFile?action=createFile',
      {
        file: {
          contentType: file.type || 'application/octet-stream',
          lastModified: file.lastModifiedDate.toISOString(),
          size: file.size,
          name: file.name,
          page: {id: page},
          description: file.desc,
          note: file.note
        },
        content: content,
      }, reqSettings
    ).then((response)=>{//Successful Call
      var id = response ? response.data : null;
      that.setState({loading: false, uploaded: true});
      if ( that.props && typeof that.props.onUpload === 'function' ) {
        that.props.onUpload(id);
      }
    }).catch(function(thrown) {//Failed Call
      if (!axios.isCancel(thrown)) {//Failure was not a cancel
        that.setState({loading: false, requestError: thrown});
        if ( that.props && typeof that.props.onError === 'function' ) {
          that.props.onError(thrown);
        }
        console.error('postFile Error\n',thrown);
      }
    });
  }
  /**
   * Called when the file has been read by the browser
   * @param {Event} load FileReader load event
   * Note, the target (FileReader) has additional attributes added to it:
   * sourceFile: The File information that was read
   */
  fileOnload(load) {
    if ( !load || !load.target ) { return; }
    var content = load.target.result;
    content = base64ArrayBuffer(content);
    var file = load.target.sourceFile || {};
    file.desc = this.state.desc;
    file.note = this.state.note;
    //console.log(file.name+' -- '+file.type+' -- '+file.lastModified+' -- '+file.lastModifiedDate.toISOString()+' -- '+file.size);
    //console.log(content);
    this.postFile(file, content);
  }
  /**
   * Upload Button was clicked
   */
  onUpload() {
    //Retrieve the FileList
    var files = this.files;
    if ( !files || files.length < 1 ) { return; }
    //Set loading to true
    this.setState({loading: true});
    var file = files[0];
    //Make a FileReader
    const reader = new FileReader();
    reader.onload = this.fileOnload.bind(this);
    //Assign extra properties to read later
    reader.sourceFile = file;
    //Read the file
    reader.readAsArrayBuffer(file);
  }
  /**
   * Contents of the File Input Changed
   * @param {*} e 
   */
  onFileSelected(e) {
    var files = null;
    //Convert to the native element
    var native = e ? e.nativeEvent : {};
    //Get the FileList
    files = native.target ? native.target.files : null;
    //Save to the component (does not drive rendering, so no need to put in state)
    this.files = files;
    //Reset uploaded to false
    this.setState({uploaded: false});
  }
  handleInput(e, d) {
    var state = {};
    state[d.name] = d.value;
    this.setState(state);
  }
  /**
   * render
   */
  render() { return (
    <div style={{border: '1px solid #bbb', margin: '1rem', padding: '1rem'}}>
      <div style={{fontSize: '1.5rem', margin: '1rem'}}>
        Upload New File
      </div>
      <Form success={this.state.uploaded}>
        <Form.Field width={8}>
          <Input type='file' onChange={(e)=>this.onFileSelected(e)} placeholder="Select File" />
        </Form.Field>
        <Form.Group>
        <Form.Field width={8}>
          <label>Description</label>
          <Input placeholder="Optional File Description..." 
            name="desc" value={this.state.desc}
            onChange={(e,d)=>this.handleInput(e,d)} />
        </Form.Field>
        <Form.Field width={8}>
          <label>Note</label>
          <Input placeholder="Optional Additional Note..."
            name="note" value={this.state.note}
            onChange={(e,d)=>this.handleInput(e,d)} />
        </Form.Field>
        </Form.Group>
        <Button onClick={()=>this.onUpload()} disabled={this.state.loading||this.state.uploaded} loading={this.state.loading} >
          <Icon name='file' />Upload
        </Button>
        <Message success header="File Upload Completed" />
      </Form>
    </div>
  )}
}
/**
 * Convert ArrayBuffer to base64 String.
 * Copied From: https://gist.github.com/jonleighton/958841
 * MIT License
 * @param {ArrayBuffer} arrayBuffer 
 */
function base64ArrayBuffer(arrayBuffer) {
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder
  var a, b, c, d
  var chunk
  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1
    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }
  // Deal with the remaining bytes and padding
  if (byteRemainder === 1) {
    chunk = bytes[mainLength]
    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2
    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1
    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]
    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4
    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1
    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }
  return base64
}
//Assign PropTypes
ReferenceFiles.propTypes = PropsReferenceFiles;
ReferenceFileList.propTypes = PropsReferenceFileList;
ReferenceFileUploader.propTypes = PropsReferenceFileUploader;
//Export Default
export default ReferenceFiles;
