require 'sinatra'
require 'rack-ssl-enforcer'
require 'haml'

module Tasseo
  class Application < Sinatra::Base

    configure do
      enable :logging
      mime_type :js, 'text/javascript'
      use Rack::SslEnforcer if ENV['FORCE_HTTPS']
    end

    helpers do
      def find_dashboards(path='')
        searchpath = "public/d/" + path
        @ignore = ['.', '..', '.gitignore']
        @dashboards = []
        Dir.foreach(searchpath).sort.each do |f|
          next if @ignore.include?(f)
          if File.directory?(searchpath + f)
            @dashboards.push(f)
          else
            @dashboards.push(f.split(".").first)
          end
        end
      end

      def handle_dir(path='')
        find_dashboards(path)
        if !@dashboards.empty?
          haml :index, :locals => {
            :dashboard => nil,
            :list => @dashboards,
            :error => nil,
            :path  => path
          }
        else
          haml :index, :locals => {
            :dashboard => nil,
            :list => nil,
            :error => 'No dashboard files found.'
          }
        end
      end
    end

    get '/' do
      handle_dir()
    end

    get %r{/([\S]+)} do
      path = params[:captures].first
      if File.exists?("public/d/" + path + ".js")
        haml :index, :locals => { :dashboard => path }
      elsif File.directory?("public/d/" + path)
        find_dashboards(path)
        handle_dir('/' + path)
      else
        find_dashboards()
        haml :index, :locals => {
          :dashboard => nil,
          :list => @dashboards,
          :error => 'That dashboard does not exist.',
          :path  => path
        }
      end
    end
  end
end
