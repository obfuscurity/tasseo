require 'rack/test'
require 'spec_helper'

require 'web'

describe Tasseo::Application do
  include Rack::Test::Methods

  def app
    Tasseo::Application
  end

  describe 'GET /health' do
    it 'should respond with a 200' do
      get '/health'
      last_response.should be_ok
    end

    it 'should respond with the text "ok"' do
      get '/health'
      last_response.body.should eq('ok')
    end
  end
end
