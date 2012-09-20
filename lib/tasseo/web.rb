require 'sinatra'
require 'rack-ssl-enforcer'
require 'haml'
require 'json'
require 'sinatra_auth_github'

module Tasseo
  class Web < Sinatra::Base

    configure do
      enable :logging
      enable :sessions
      mime_type :js, 'text/javascript'
      use Rack::SslEnforcer if ENV['FORCE_HTTPS']

      if ENV['GITHUB_AUTH_ORGANIZATION']
        set :github_options, { :scopes => "user" }

        register Sinatra::Auth::Github
      end
    end

    before do
      if organization = ENV['GITHUB_AUTH_ORGANIZATION']
        github_organization_authenticate!(organization) unless request.path == '/health'
      end

      find_dashboards
    end

    helpers do
      def dashboards
        @dashboards
      end

      def dashboards_dir
        "#{File.dirname(__FILE__)}/public/d"
      end

      def find_dashboards
        @dashboards = []
        Dir.foreach(dashboards_dir).grep(/\.js/).sort.each do |f|
          @dashboards.push(f.split(".").first)
        end
      end
    end

    get '/' do
      if !dashboards.empty?
        if request.accept.include?('application/json')
          content_type 'application/json'
          status 200
          { :dashboards => dashboards }.to_json
        else
          haml :index, :locals => {
            :dashboard => nil,
            :list => dashboards,
            :error => nil
          }
        end
      else
        if request.accept.include?('application/json')
          content_type 'application/json'
          status 204
        else
          haml :index, :locals => {
            :dashboard => nil,
            :list => nil,
            :error => 'No dashboard files found.'
          }
        end
      end
    end

    get '/health' do
      content_type :json
      {'status' => 'ok'}.to_json
    end

    get %r{/([\S]+)} do
      path = params[:captures].first
      if dashboards.include?(path)
        haml :index, :locals => { :dashboard => path }
      else
        body = haml :index, :locals => {
          :dashboard => nil,
          :list => dashboards,
          :error => 'That dashboard does not exist.'
        }
        [404, body]
      end
    end
  end
end

