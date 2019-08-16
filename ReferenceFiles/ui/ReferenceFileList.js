import React from 'react';
import PropTypes from 'prop-types';
import { Input, Button, Loader, Form, Confirm, Modal, Header } from 'semantic-ui-react'
import _ from 'lodash';
import axios from 'axios';
import * as RefUtils from './ReferenceFileUtils';

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
      headers: RefUtils.apiHeaders(),
      timeout: 20000,
      cancelToken: that._source.token,
    };
    axios.post(RefUtils.apiUrl() + 'ReferenceFile?action=fetch',
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
    axios.post(RefUtils.apiUrl() + 'ReferenceFile?action=editFile',
      { 
        file: {id: file.id},
        remove: true
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
    axios.post(RefUtils.apiUrl() + 'ReferenceFile?action=editFile',
      { 
        file: fileProp
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
              <a href={RefUtils.apiUrl("file")+""+file.id}
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

//Assign PropTypes
ReferenceFileList.propTypes = PropsReferenceFileList;
//Export Default
export default ReferenceFileList;
