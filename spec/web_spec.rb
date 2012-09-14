require 'rack/test'
require 'spec_helper'

require 'web'

describe Tasseo::Application do
  include Rack::Test::Methods

  def app
    Tasseo::Application
  end

  describe '/' do
    context 'JSON' do
      before do
        header 'Accept', 'application/json'
      end
  
      context 'without dashboards' do
        before do
          Tasseo::Application.any_instance.stub(:dashboards) { [] }
        end
        
        it 'should return a 204' do
          get '/'
          last_response.status.should eq(204)
        end

        it 'should return an empty array if there are no dashboards' do
          get '/'
          last_response.body.should be_empty
        end
      end

      context 'with dashboards' do
        before do
          Tasseo::Application.any_instance.stub(:dashboards) { ['foo'] }
        end

        it 'should return ok' do
          get '/'
          last_response.should be_ok
        end

        it 'should return an array of dashboards' do
          get '/'
          last_response.body.should eq({'dashboards' => ['foo']}.to_json)
        end
      end
    end

    context 'html' do
    end
  end

  describe 'GET /health' do
    it 'should respond with a 200' do
      get '/health'
      last_response.should be_ok
    end

    it 'should respond with the text "ok"' do
      get '/health'
      last_response.body.should eq({'status' => 'ok'}.to_json)
    end

    it 'should be JSON' do
      get '/health'
      last_response.headers['Content-Type'].should eq('application/json;charset=utf-8')
    end

    context 'GITHUB_AUTH_ORGANIZATION is set' do
      before do
        ENV['GITHUB_AUTH_ORGANIZATION'] = 'foo'
      end

      after do
        ENV.delete('GITHUB_AUTH_ORGANIZATION')
      end

      it 'should work even if Github auth is enabled' do
        get '/health'
        last_response.should be_ok
      end
    end
  end
end
