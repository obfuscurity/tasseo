require 'sinatra'
require 'haml'

module Tasseo
  class Application < Sinatra::Base

    configure do
      enable :logging
      mime_type :js, 'text/javascript'
    end

    helpers do
      def find_dashboards
        @dashboards = []
        Dir.foreach("public/d").grep(/\.js/).sort.each do |f|
          @dashboards.push(f.split(".").first)
        end
      end
    end

    get '/' do
      find_dashboards
      haml :index, :locals => { :dashboard => nil, :list => @dashboards }
    end

    get %r{/([\S]+)} do
      haml :index, :locals => { :dashboard => params[:captures].first }
    end
  end
end

