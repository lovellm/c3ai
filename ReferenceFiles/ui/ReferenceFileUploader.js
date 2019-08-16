import React from 'react';
import PropTypes from 'prop-types';
import { Input, Icon, Button, Form, Message, } from 'semantic-ui-react'
import _ from 'lodash';
import axios from 'axios';
import * as RefUtils from './ReferenceFileUtils';

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
      headers: RefUtils.apiHeaders(),
      timeout: 120000,
      cancelToken: that._source.token
    };
    //Issue Post Call
    axios.post(RefUtils.apiUrl() + 'ReferenceFile?action=createFile',
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
    content = RefUtils.base64ArrayBuffer(content);
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

//Assign PropTypes
ReferenceFileUploader.propTypes = PropsReferenceFileUploader;
//Export Default
export default ReferenceFileUploader;
