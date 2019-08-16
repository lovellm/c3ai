import React from 'react';
import PropTypes from 'prop-types';
import { Input, Button, Form, Modal, Header } from 'semantic-ui-react'
import _ from 'lodash';
import axios from 'axios';
import * as RefUtils from './ReferenceFileUtils';
import ReferenceFileList from './ReferenceFileList';
import ReferenceFileUploader from './ReferenceFileUploader';
const cachios = require('cachios');

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
      headers: RefUtils.apiHeaders(),
      timeout: 20000,
      cancelToken: that._source.token
    };
    var reqs = [];
    //Request for Pages
    reqs.push(axios.post(RefUtils.apiUrl() + 'ReferencePage?action=fetch',
        { spec: {
          order: 'sort',
          filter: filter
        }}, reqSettings
    ));
    //Request for User
    if ( userFetch ) {
      reqs.push(cachios.post(RefUtils.apiUrl() + 'User?action=myUser',
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
    axios.post(RefUtils.apiUrl() + 'ReferencePage?action=merge',
      { 
        this: pageProp
      }, {
        ttl: 360,
        headers: RefUtils.apiHeaders(),
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
    axios.post(RefUtils.apiUrl() + 'ReferencePage?action=create',
      { 
        this: pageProp
      }, {
        ttl: 360,
        headers: RefUtils.apiHeaders(),
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

//Assign PropTypes
ReferenceFiles.propTypes = PropsReferenceFiles;
//Export Default
export default ReferenceFiles;
