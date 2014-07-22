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
      use Rack::Static, :urls => ['/dashboards/']

      set :protection, :except => :frame_options
      set :session_secret, ENV['SESSION_SECRET'] || Digest::SHA1.hexdigest(Time.now.to_f.to_s)
      set :github_options, { :scopes => "user" }

      if ENV['GITHUB_AUTH_TEAM'] || ENV['GITHUB_AUTH_ORGANIZATION']
        register Sinatra::Auth::Github
      end
    end

    before do
      if team = ENV['GITHUB_AUTH_TEAM']
        github_team_authenticate!(team) unless request.path == '/health'
      elsif organization = ENV['GITHUB_AUTH_ORGANIZATION']
        github_organization_authenticate!(organization) unless request.path == '/health'
      end

      find_dashboards
    end

    helpers do
      def dashboards
        @dashboards
      end

      def dashboards_dir
        File.expand_path('../../../dashboards', __FILE__)
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

    if ENV['USE_PROXY']
      get %r{/proxy/(.*)} do
        uri = URI("#{ENV['GRAPHITE_URL'] || ENV['INFLUXDB_URL']}/#{params[:captures].first}?#{request.query_string}")
        res = Net::HTTP.get_response(uri)
        content_type :json
        res.body
      end
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

