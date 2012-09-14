require 'rack/test'
require 'spec_helper'

require 'web'

describe Tasseo::Application do
  include Rack::Test::Methods

  def app
    Tasseo::Application
  end

  it 'should have some tests'
end
